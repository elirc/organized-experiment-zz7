# Build Journal

## Stage 1 — Project framing
Built: Combined a procurement operations product with an analytics/reporting layer.
Decision: Use multi-tenancy because this domain realistically serves multiple organizations and benefits from explicit tenant-aware auth.
Why: It makes tenant scoping a first-class architectural concern instead of a future retrofit.

## Stage 2 — Stack choice
Built: Next.js App Router, TypeScript, PostgreSQL, Prisma, Tailwind, Zod, React Query, REST routes.
Decision: Chose Prisma over Drizzle.
Why: The domain has many relations and a few transaction-heavy workflow transitions, and Prisma made the model and transactional service code easier to read quickly.

## Stage 3 — Domain and schema
Built: `prisma/schema.prisma` with organizations, memberships, sessions, vendors, RFQs, quotes, purchase orders, receipts, discrepancies, report definitions, export jobs, and audit logs.
Decision: Keep report definitions and export jobs as a separate module over procurement data rather than stuffing reporting logic into PO services.
Why: Saved-query lifecycle and async export state are different concerns from procurement mutations.

## Stage 4 — Auth and permissions
Built: `src/lib/auth/session.ts`, `src/services/authService.ts`, `src/lib/http/route.ts`, `src/lib/auth/page-session.ts`, and `src/lib/validation/authSchemas.ts`.
Decision: Use signed cookie sessions backed by revocable DB session rows.
Why: It teaches a stronger pattern than client-only tokens while staying simpler than a full external auth provider.

## Stage 5 — Repository and service layers
Built: Tenant-scoped repositories in `src/repositories/**` and workflow services in `src/services/**`.
Decision: Keep transaction boundaries in services, not repositories.
Why: The service layer is where cross-aggregate business rules live, so it should decide when multiple repository operations must succeed together.

## Stage 6 — UI and request flow
Built: `src/components/**`, `src/hooks/**`, and route handlers under `src/app/api/**`.
Decision: Let hooks consume page-shaped read models from routes instead of raw entities.
Why: It keeps React components cleaner and preserves the backend as the place where reporting/operational meaning is assembled.

## Stage 7 — Async exports and tests
Built: Export queue + runner in `src/services/exportJobService.ts` and focused Vitest coverage under `src/test/**`.
Decision: Model export jobs as first-class records with `PENDING/RUNNING/SUCCEEDED/FAILED`.
Why: Background work needs observable operational state, not just a button that "downloads something."

## Stage 8 — Documentation and learning artifacts
Built: `docs/architecture/**`, `docs/learning/**`, and `docs/learning/agent-usage.md`.
Decision: Anchor docs to actual files and functions instead of generic explanations.
Why: The goal is to teach code reading, not to ship abstract architecture prose.

## PR Slices

### Slice 1 — Schema, auth primitives, and route boundary
Purpose: Establish the data model, session model, and reusable request wrapper before feature work.
Novel logic files: `prisma/schema.prisma`, `src/lib/auth/session.ts`, `src/services/authService.ts`, `src/lib/http/route.ts`, `src/lib/validation/authSchemas.ts`.
Reviewer focus:
- `prisma/schema.prisma`: verify tenant-owned tables really carry `tenantId` and workflow enums cover the intended states.
- `src/services/authService.ts`: verify `resolveSessionFromSignedToken()` checks signed token claims against the DB session row, not just the JWT.
- `src/lib/http/route.ts`: verify auth and permission checks run before handlers execute.
What a junior reviewer might miss: A session cookie can still be insecure even if login "works" if revocation is not enforced server-side.

### Slice 2 — Procurement CRUD and sourcing workflows
Purpose: Add vendors, RFQs, and quotes with explicit service/repository boundaries.
Novel logic files: `src/repositories/vendorRepository.ts`, `src/repositories/sourcingRepository.ts`, `src/services/vendorService.ts`, `src/services/sourcingService.ts`, `src/app/api/vendors/route.ts`, `src/app/api/rfqs/**`.
Reviewer focus:
- `src/repositories/sourcingRepository.ts`: verify quote selection updates sibling quotes and the parent RFQ together.
- `src/services/sourcingService.ts`: verify quote totals are recomputed on the server.
What a junior reviewer might miss: Client-provided totals are a trust boundary issue, not just a convenience field.

### Slice 3 — Purchase-order workflow and receiving
Purpose: Add the strongest business-process logic in the app.
Novel logic files: `src/repositories/purchaseOrderRepository.ts`, `src/services/purchaseOrderService.ts`, `src/app/api/purchase-orders/**`, `src/lib/validation/purchaseOrderSchemas.ts`.
Reviewer focus:
- `src/services/purchaseOrderService.ts`: verify quantity checks use cumulative receipt history before writing.
- `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts`: verify approver identity comes from the session, not the body.
- `src/app/api/purchase-orders/[purchaseOrderId]/receive/route.ts`: verify route-param PO ownership beats body IDs.
What a junior reviewer might miss: Over-receiving often happens through several small valid requests, not one obviously bad request.

### Slice 4 — Reporting and async exports
Purpose: Add saved reports, export jobs, and reporting read models over the procurement data.
Novel logic files: `src/repositories/reportRepository.ts`, `src/repositories/exportJobRepository.ts`, `src/repositories/dashboardRepository.ts`, `src/services/reportService.ts`, `src/services/exportJobService.ts`, `src/app/api/reports/**`.
Reviewer focus:
- `src/services/exportJobService.ts`: verify queueing and processing are separate methods and stay tenant-scoped.
- `src/repositories/dashboardRepository.ts`: verify analytics reads still apply `tenantId`.
What a junior reviewer might miss: Reporting tables and export jobs are just as sensitive as procurement transactions because they can expose cross-tenant slices.

### Slice 5 — UI shell, tests, and docs
Purpose: Make the product explorable and the codebase teachable.
Novel logic files: `src/components/auth/login-page.tsx`, `src/components/layout/app-shell.tsx`, `src/hooks/**`, `src/test/**`, `docs/**`.
Reviewer focus:
- `src/components/auth/login-page.tsx`: verify it uses the real auth route and seed route instead of fake local auth.
- `src/test/purchase-order-transition.test.ts`: verify the test targets a real risky workflow rule.
- `docs/architecture/request-lifecycle.md`: verify the traced files/functions match the code as shipped.
What a junior reviewer might miss: Docs can become wrong architecture if they are not treated as part of the review surface.

---

## Reviewing the slices against the shipped code

The repository has a single commit (`Import zz7 from Organized Desktop`), so the stages and slices above cannot be checked against history. What can be checked is whether each slice's reviewer-focus items hold in the code as it is now. Each item below is marked as it was found.

### Slice 1

| Reviewer focus | Result | Evidence |
|---|---|---|
| Tenant-owned tables carry `tenantId` | holds for the nine top-level workflow tables; line-item tables inherit from their parent | `schema.prisma:152-373` |
| Workflow enums cover the intended states | the enums do; the code only ever writes four of seven PO statuses, two of four RFQ statuses, and three of five quote statuses | `docs/architecture/domain-model.md` |
| `resolveSessionFromSignedToken()` checks claims against the DB row | holds: id, user, organization, expiry, then membership | `authService.ts:99-129` |
| Auth and permission run before handlers | holds | `route.ts:77-84` |
| Missed by the original review | malformed JSON is a 500; `SESSION_SECRET` silently falls back to a fixed value | `route.ts:37`, `env.ts:15-16` |

### Slice 2

| Reviewer focus | Result | Evidence |
|---|---|---|
| Quote selection updates siblings and the RFQ together | holds, and runs inside the PO-create transaction | `sourcingRepository.ts:153-192` |
| Quote totals recomputed on the server | holds | `sourcingService.ts:93-96` |
| Missed by the original review | vendor status not checked when quoting; `validUntil` never compared with now; RFQ transition helper never used; no vendor uniqueness pre-check, so a duplicate code is a 500 | `sourcingService.ts:76-91`, `rfqSchemas.ts:52-61` |

### Slice 3

| Reviewer focus | Result | Evidence |
|---|---|---|
| Cumulative receipt checks before writing | holds across earlier receipts; fails for duplicate entries in one payload | `purchaseOrderService.ts:204-221` |
| Approver identity from the session | holds | `purchaseOrderService.ts:134` |
| Route-param PO beats body IDs | holds, because the param is spread after the body | `receive/route.ts:23-26` |
| Missed by the original review | second partial receipt → 500; self-approval; overlapping approvals both succeed; illegal transitions → 500; a quote can become many POs; discrepancy line items unchecked | see `docs/architecture/auth-and-permissions.md` |

The slice's "what a junior reviewer might miss" says over-receiving "often happens through several small valid requests". In this code the opposite holds: several small requests are blocked (the second partial receipt fails outright), and the over-receive that does get through is one request with a repeated line.

### Slice 4

| Reviewer focus | Result | Evidence |
|---|---|---|
| Queueing and processing are separate methods | holds | `exportJobService.ts:24-60`, `:67-123` |
| They stay tenant-scoped | reads yes; `mark*` writes update by `id` only | `exportJobRepository.ts:71-107` |
| Analytics reads apply `tenantId` | holds for every query | `dashboardRepository.ts:68-234` |
| Missed by the original review | double processing; date filters ignored; processing ignores the queued snapshot and then overwrites it; `CUSTOM` and `PURCHASE_ORDER_PIPELINE` produce the same rows; no file is ever produced | `exportJobService.ts:75`, `:94`; `dashboardRepository.ts:55-61`, `:213-233` |

### Slice 5

| Reviewer focus | Result | Evidence |
|---|---|---|
| Login page uses the real routes | holds | `login-page.tsx:40`, `:66` |
| The transition test targets a real risky rule | partly: it tests one illegal edge and missed the missing self-loop | `purchase-order-transition.test.ts:11-20` |
| Request-lifecycle doc matches the code | mostly; order of wrapper vs handler was off in two traces, now corrected | `docs/architecture/request-lifecycle.md` |
| Missed by the original review | `seed-demo` is public and returns passwords; hooks hide errors behind sample data; "Queue export" only logs; the README was still the `create-next-app` template | `seedDemoService.ts:22-30`, `use-*-data.ts`, `reports-page.tsx:168-174` |

## Stage notes checked against the code

- **Stage 2 (stack):** confirmed in `package.json`: Next 16.2.2, React 19.2.4, Prisma ^6.7.0, Zod ^3.24.3, React Query ^5.75.7, Tailwind 4, Vitest ^3.1.2. Auth uses `jose` for JWTs and `bcryptjs` for passwords.
- **Stage 3 (schema):** confirmed, 17 models and 11 enums. There is no migrations folder, so the schema has never been captured as a migration in this repo.
- **Stage 4 (auth):** confirmed. "Revocable DB session rows" is accurate: logout deletes the row, and the next request fails at the hash lookup.
- **Stage 5 ("transaction boundaries in services"):** confirmed for the PO workflow. Vendor, RFQ, quote, report, and export services do not use transactions at all; each makes a business write and an audit write as two separate calls.
- **Stage 6 ("hooks consume page-shaped read models"):** confirmed, with the caveat that some of the shaping invents values. See the correction in `docs/architecture/README.md`.
- **Stage 7 ("export jobs as first-class records"):** confirmed for the record. The "observable operational state" holds until two runners overlap or a run crashes mid-job: there is no claim and no recovery for a job stuck in `RUNNING`.
- **Stage 8 ("anchor docs to actual files"):** the original docs did name real files and functions throughout. Where they went wrong was in behavior claims (transactions, cumulative checks, tenant scoping of writes), which is why this pass added line numbers and run checks.
