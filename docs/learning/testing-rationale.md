# Testing Rationale

`src/test/auth-permissions.test.ts` — `rejects a viewer trying to approve a purchase order`
This matters because `"purchaseOrder.approve"` is a finance-control boundary. If a viewer can reach that action in production, approval history stops meaning anything. A fuller suite would also hit `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts` end-to-end and assert the exact `403` response shape.

`src/test/auth-permissions.test.ts` — `allows a procurement manager to approve a purchase order`
This matters because over-restrictive RBAC is also a production bug. Teams will work around a broken approval path manually, which is how shadow processes appear. A fuller suite would test several roles against several route-level permissions, not just one allow case.

`src/test/validation-boundaries.test.ts` — report-definition validation rejection
This matters because saved reports can become long-lived bad state if unsupported dimensions, duplicate metrics, or inverted date filters are accepted once. A fuller suite would pair schema tests with route tests for `src/app/api/reports/route.ts`.

`src/test/purchase-order-transition.test.ts` — invalid purchase-order transition
This matters because workflow corruption usually starts with one illegal state hop that "seemed harmless" at the time. If a PO can skip approval or move backward incorrectly, downstream receiving and analytics become unreliable. A fuller suite would test `receivePurchaseOrder()` in `src/services/purchaseOrderService.ts` with several partial/full receipt sequences.

`src/test/tenant-isolation.test.ts` — cross-tenant mismatch rejection
**Correction:** the function under test, `assertTenantScope()` (`src/lib/validation/authSchemas.ts:123-130`), is not called anywhere in `src/` outside this test. Tenant isolation is actually enforced by `where: { tenantId }` clauses in the repositories, which this test never touches. The test proves a helper works; it does not protect the app. Its own comment ("This guards the repository boundary we expect later", `tenant-isolation.test.ts:12`) is honest about that.
This matters because tenant isolation is the highest-severity correctness rule in the entire codebase. A fuller suite would add repository-level tests asserting that methods like `findById()` in `src/repositories/vendorRepository.ts` and `src/repositories/purchaseOrderRepository.ts` always include `tenantId` in the query.

Overall review comment:
These tests are intentionally light, but they are load-bearing. They target the classes of bugs that tend to survive happy-path CRUD coverage: authorization drift, validation drift, invalid workflow transitions, and tenant leaks. In a production suite, the next layer to add would be route-level integration tests that prove the request wrapper, Zod boundary, service layer, and repository scoping all stay aligned.

**Correction on "load-bearing":** two of the four files test code that the app does run (`requirePermission()` through `assertPermission()`, and the PO transition map). One tests an unused helper (`assertTenantScope()`). One tests Zod schemas, of which two (`vendorCreateSchema`, `rfqCreateSchema`) and one (`reportDefinitionSchema`) are used by routes. None of the defects listed in `docs/architecture/README.md` would make any of these tests fail.

---

## Does `npm test` run these tests?

By reading the config, yes:

- `package.json:10` maps `test` to `vitest` (`test:run` to `vitest run`).
- `vitest.config.ts:14-19` sets the node environment, globals, `src/test/setup.ts` as the setup file, and `include: ["src/test/**/*.test.ts"]`. All four test files match.
- The `@` alias is defined in the config (`vitest.config.ts:20-24`), matching `tsconfig.json:21-23`, so `import ... from "@/lib/validation"` resolves.
- `src/test/setup.ts:7` imports `@testing-library/jest-dom`, which is in `devDependencies` (`package.json:29`). It adds DOM matchers that no current test uses.
- None of the tests import Prisma, Next.js, or the database, so they need no `DATABASE_URL`.

`npm test` without `run` starts Vitest in watch mode in an interactive terminal; in CI (no TTY) Vitest runs once and exits.

**This was not executed here.** `node_modules` is absent and installs were not allowed. By reading, the assertions in the three Zod-free files match the functions they call; `validation-boundaries.test.ts` needs Zod installed.

## What each test proves and does not prove

| Test | Proves | Does not prove |
|---|---|---|
| `auth-permissions` — viewer cannot approve | `requirePermission()` throws `AuthorizationError` for `VIEWER` + `purchaseOrder.approve` | that the approve route uses this permission (it does, `approve/route.ts:37`), that the error becomes 403, or anything about the other 71 role/permission pairs |
| `auth-permissions` — manager can approve | the allow path returns `true` | that a manager cannot approve their own PO (they can) |
| `purchase-order-transition` — DRAFT → RECEIVED rejected | the map rejects one illegal jump | that the service calls the guard (it does, `purchaseOrderService.ts:131`, `:241`); that the error is a 409 (it is a 500); that legal repeated states such as a second partial receipt are allowed (they are not) |
| `purchase-order-transition` — PENDING_APPROVAL → APPROVED allowed | one legal edge | the race between two approvals |
| `tenant-isolation` — both cases | `assertTenantScope()` compares two strings | anything about repositories, which never call it |
| `validation-boundaries` — vendor | a payload with four bad fields at once fails | which field failed; that each rule works on its own |
| `validation-boundaries` — RFQ | an empty `lineItems` array fails | anything else about the RFQ schema |
| `validation-boundaries` — report | duplicate dimensions *and* inverted dates together fail | that either rule works alone (one failing rule is enough for `success: false`); that saved date filters are actually applied when the export runs (they are not) |

The vendor and report cases each combine several invalid inputs, so they would still pass if all but one of the rules were deleted.

## Dependency-free checks you can write

None of these was executed for this guide. Each is a check that needs no database: copy the cited lines into an `.mjs`, strip the TypeScript types, inject in-memory fakes for the repositories (each fake should mirror the real `where` clause, for example `approve()` matching on `id` and `tenantId` only, and yield to the event loop between read and write), and run with `node --test`. The "Expected" column is what reading the cited lines predicts.

| # | Check | Source lines to copy | Expected (by reading) |
|---|---|---|---|
| 1 | role × permission matrix for five route gates | `authSchemas.ts:49-121` | run-pending allows 5 of 6 roles; approve allows `ORG_ADMIN`, `PROCUREMENT_MANAGER`; `SUPER_ADMIN` passes all |
| 2 | illegal approve transitions through `handleRouteError()` | `purchaseOrderSchemas.ts:75-97`, `route.ts:33-69`, `errors.ts:11-50` | plain `Error` → 500 for `APPROVED`, `DRAFT`, `RECEIVED`, `CANCELLED` |
| 3 | `parseJsonBody()` with `"{bad json"` | `route.ts:33-69` | `SyntaxError` → 500; Zod failure → 400 |
| 4 | receive on `PENDING_APPROVAL` | `purchaseOrderService.ts:182-241` | 409 |
| 5 | sequential over-receive (100 + 21 of 120) | same | 409 |
| 6 | same line twice in one payload | same | 240 of 120 recorded, status `RECEIVED` |
| 7 | discrepancy with a foreign line id | same | accepted |
| 8 | all quantities 0 | same | accepted, `PARTIALLY_RECEIVED` |
| 9 | requester approves own PO | `purchaseOrderService.ts:124-156` | approved |
| 10 | sequential double approve | same | second → 500 |
| 11 | overlapping double approve | same | both succeed, two audit rows |
| 12 | overlapping run-pending | `exportJobService.ts:67-123` | job run twice, two audit rows |
| 13 | sequential run-pending | same | second finds nothing |
| 14 | report filter with stored `dateFrom` | `dashboardRepository.ts:24-65` | string date excludes nothing; real `Date` works; `minAmount` works |
| 15 | two POs from one quote | `purchaseOrderService.ts:23-25`, `:33-122` | both created; body currency, vendor, lines replaced by the quote's |
| 16-18 | replay of the three Zod-free Vitest files | `authSchemas.ts`, `purchaseOrderSchemas.ts` | the same assertions hold |
| 19 | second partial receipt | `purchaseOrderService.ts:182-241` | plain `Error` → 500 |

The race checks (11, 12) show what the code permits; how often the races would hit in production depends on timing, and only a test against a real database proves the fix.

## Tests worth adding, tied to findings

| Test | Level | Expected today | Expected after the fix |
|---|---|---|---|
| `receivePurchaseOrder()` twice with partial quantities | service with a test DB | second call throws a plain `Error` | second call succeeds, PO stays `PARTIALLY_RECEIVED` |
| receive payload with the same `purchaseOrderLineItemId` twice | service | accepted | 409 |
| discrepancy pointing at another PO's line | service | accepted | 409 |
| requester approves own PO | service | approved | 403 |
| two concurrent approvals (`Promise.all`) | service with a real DB | both resolve | one resolves, one 409 |
| approve an `APPROVED` PO | route | 500 | 409 |
| two concurrent `runPendingJobs()` | service with a real DB | job processed twice | processed once |
| `POST /api/seed-demo` with no cookie after seeding | route | 200 with passwords | 404 or 403 outside demo mode |
| malformed JSON to `POST /api/vendors` | route | 500 | 400 |
| report with `dateFrom` in the future, then export | service | all rows | zero rows |
| second PO from the same quote | service | created | 409 |
| full role × route matrix | unit, table-driven | — | pins every cell in `docs/architecture/auth-and-permissions.md` |
| each Zod rule in isolation | unit | — | one invalid field per case |
| `ANALYST` calls `GET /api/purchase-orders`; hook output | hook | sample data | error state |

Most of these need a database. The repo has no test database setup, no factories, and no Prisma mocking layer, so the first piece of work is a test harness, not the tests.
