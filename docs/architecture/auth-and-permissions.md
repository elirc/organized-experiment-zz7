# Auth And Permissions

Authentication starts in `src/app/api/auth/login/route.ts`, which parses `loginRequestSchema` from `src/lib/validation/authSchemas.ts` and then calls `authService.login()` in `src/services/authService.ts`. Password verification happens in `verifyPassword()` in `src/lib/auth/password.ts`. Session issuance uses `createOpaqueSessionToken()`, `hashSessionToken()`, and `signSessionToken()` from `src/lib/auth/session.ts`, and the signed token is written as the `procureflow_session` cookie in the login route.

Session resolution is centralized, not spread across pages and routes:

- API requests go through `withRouteAuth()` in `src/lib/http/route.ts`.
- `withRouteAuth()` calls `resolveSessionFromRequest()` in `src/services/authService.ts`.
- `resolveSessionFromRequest()` reads the cookie and delegates to `resolveSessionFromSignedToken()` in the same file.
- `resolveSessionFromSignedToken()` verifies the JWT, hashes the embedded opaque token, loads the backing session row through `authRepository.findSessionByTokenHash()` in `src/repositories/authRepository.ts`, and then reloads membership through `authRepository.findMembershipForUser()`.
- Server-rendered pages use `requirePageSession()` in `src/lib/auth/page-session.ts`, which shares the same `resolveSessionFromSignedToken()` path instead of inventing a second auth mechanism.

Role-based access control is explicit and centralized:

- The source permission vocabulary lives in `requirePermission()` and `rolePermissionMatrix` in `src/lib/validation/authSchemas.ts`.
- App-facing guards adapt that contract in `assertPermission()` inside `src/lib/auth/permissions.ts`.
- Route-level checks happen in `withRouteAuth()` in `src/lib/http/route.ts`, which accepts `options.permission` such as `"vendor.read"`, `"purchaseOrder.approve"`, or `"report.export"`.
- Example protected routes:
  `src/app/api/vendors/route.ts` requires `"vendor.read"` or `"vendor.write"`.
  `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts` requires `"purchaseOrder.approve"`.
  `src/app/api/reports/[reportId]/exports/route.ts` requires `"report.export"`.

Multi-tenancy is first-class. The tenant model is `Organization` in `prisma/schema.prisma`, and tenant-owned tables use a `tenantId` column that points at `Organization.id`. Tenant isolation is enforced in repository queries, not in React:

- `src/repositories/vendorRepository.ts` scopes every vendor query by `tenantId`.
- `src/repositories/sourcingRepository.ts` scopes RFQ and quote queries by `tenantId`.
- `src/repositories/purchaseOrderRepository.ts` scopes list/find/update calls by `tenantId`.
- `src/repositories/reportRepository.ts` and `src/repositories/exportJobRepository.ts` scope report definitions and export jobs by `tenantId`. **Correction:** this holds for the reads (`listForTenant()` and `findPendingBatch()` in `exportJobRepository.ts:44-69`), but not for the three state writes. `markRunning()`, `markSucceeded()`, and `markFailed()` update `where: { id }` only (`exportJobRepository.ts:71-107`). They are safe today only because their one caller, `runPendingJobs()`, passes IDs that came from a tenant-scoped read (`exportJobService.ts:68`). See finding 6 below.
- `src/repositories/dashboardRepository.ts` scopes dashboard counts and analytics datasets by `tenantId`.

What would need to change to support platform-level admin features beyond the current design:

- Add platform-admin-only routes under `src/app/api/admin/**`.
- Keep `PlatformRole` checks in `src/lib/auth/permissions.ts` separate from organization membership rules. **Correction:** today the only `PlatformRole` check is not in `permissions.ts`. It is the `SUPER_ADMIN` short-circuit inside `requirePermission()` at `src/lib/validation/authSchemas.ts:111-113`, which returns `true` for every permission. No code path creates a `SUPER_ADMIN` (the seed sets `platformRole: "USER"` for all three users, `seedDemoService.ts:56`, `:64`, `:72`), and a super admin still needs a `Membership` row to get a session at all (`authService.ts:120-125`).
- Continue requiring repository methods to accept `tenantId` for tenant-owned data, even when the caller is a platform admin, so elevated access stays explicit instead of becoming an accidental default.

---

## How to read the rest of this page

Everything below was checked by reading the code at the commit this page ships with; nothing was executed, because `node_modules` is not installed in this checkout. Statements are marked **(by reading)** where the distinction matters. `docs/learning/testing-rationale.md` lists dependency-free checks that would turn the most important readings into executed tests.

## Login, step by step

`POST /api/auth/login` (`src/app/api/auth/login/route.ts:18-34`):

1. The route is wrapped in `withPublicRoute()` (`src/lib/http/route.ts:91-101`). No session is required and no permission is checked.
2. `parseJsonBody(request, loginRequestSchema)` (`route.ts:33-48`). The schema (`authSchemas.ts:20-24`) requires a trimmed email, a password of at least 12 characters, and a non-empty `organizationSlug`. A Zod failure becomes `400 VALIDATION_ERROR`. A body that is not valid JSON becomes `500` (see "Inside `withRouteAuth()`" below).
3. `authService.login()` (`authService.ts:48-84`) looks up the membership by email and organization slug in one query (`authRepository.ts:14-25`). If there is no membership, it throws `UnauthorizedError("Invalid login credentials.")` (401).
4. `verifyPassword()` (`password.ts:17-19`, bcrypt `compare`). A wrong password throws the same 401 with the same message, so the response body does not reveal whether the email exists. **(by reading)** The response time can: bcrypt only runs when a membership was found (`authService.ts:54-58`), so an unknown email returns measurably faster.
5. A 32-byte random opaque token is created (`session.ts:27-29`). Its SHA-256 hash is stored in `Session.tokenHash` with `expiresAt` 7 days ahead (`authService.ts:64-71`).
6. A JWT is signed with HS256 containing `{ sessionId, userId, organizationId, token }` (`session.ts:35-41`), also with a 7-day expiry. Note that the raw opaque token is *inside* the JWT payload. A JWT is signed, not encrypted, so anyone holding the cookie can read the opaque token. That is fine because the cookie is the credential anyway.
7. The route sets the `procureflow_session` cookie: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `maxAge` 7 days, and `secure` only when `NODE_ENV === "production"` (`login/route.ts:25-31`). The body is `{ session }`, the `AuthenticatedSession` shape from `session-context.ts:13-24`.

There is no rate limiting or lockout anywhere in the login path **(by reading)**.

## Session resolution, step by step

`resolveSessionFromSignedToken()` (`authService.ts:99-129`) is shared by API routes and server pages. Any thrown error inside it is swallowed and turned into `null` (`:126-128`):

| Step | Line | Fails when | Result |
|---|---|---|---|
| Verify the JWT signature and expiry | `:101` → `session.ts:43-47` | bad signature, expired, malformed | `null` |
| Look up `Session` by `sha256(payload.token)` | `:102` | no row (logged out, or never existed) | `null` |
| Compare `id`, `userId`, `organizationId` of the row with the JWT claims | `:108-114` | any mismatch | `null` |
| Check `expiresAt` | `:116-118` | row expired | `null` |
| Reload the membership for `(userId, organizationId)` | `:120-123` | membership deleted | `mapMembershipToSession` throws 401, caught, `null` |
| Build `AuthenticatedSession` from the membership | `:125` → `:25-45` | — | session |

Two consequences worth knowing:

- **Role changes apply on the next request.** The role comes from the freshly loaded membership, not from the JWT. Demoting someone takes effect immediately without logging them out.
- **The fallback secret is less dangerous than it looks.** `env.ts:15-16` falls back to `"dev-only-session-secret-change-me"` when `SESSION_SECRET` is unset, so anyone could sign a JWT. But a forged JWT still has to carry an opaque token whose SHA-256 hash exists in the `Session` table, and the session row must match the claimed IDs. Forging a working cookie without database access still requires guessing a 256-bit random value. The fallback should still fail fast in production, as the file's own senior note says.

`resolveSessionFromRequest()` (`:131-145`) turns both "no cookie" and "`null` session" into `UnauthorizedError` (401). `requirePageSession()` (`page-session.ts:17-32`) turns the same two cases into `redirect("/login")`.

## Inside `withRouteAuth()`

`src/lib/http/route.ts:71-89`, in order:

1. `resolveSessionFromRequest(request)`. Missing or invalid session → **401** `{ error: "UNAUTHORIZED", message: "Authentication is required." }`.
2. If `options.permission` is set, `assertPermission(session, permission)` (`permissions.ts:50-60`). That calls `requirePermission()` (`authSchemas.ts:107-121`). An `AuthorizationError` is rethrown as `ForbiddenError` → **403** `{ error: "FORBIDDEN", message: "Role VIEWER cannot perform purchaseOrder.approve" }`. The message names the role and the permission.
3. The handler runs. Whatever it throws goes to `handleRouteError()` (`route.ts:50-69`):

| Thrown value | Status | Body `error` | Where it comes from |
|---|---|---|---|
| `ZodError` | 400 | `VALIDATION_ERROR` (first issue's message) | direct `schema.parse()` in the approve, receive, quotes, and exports routes |
| `ValidationBoundaryError` | 400 | `VALIDATION_ERROR` | `parseJsonBody()` wrapping a `ZodError` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | session resolution, login |
| `ForbiddenError` | 403 | `FORBIDDEN` | permission check |
| `NotFoundError` | 404 | `NOT_FOUND` | services, for tenant-scoped lookups that return nothing |
| `ConflictError` | 409 | `CONFLICT` | services (quote not open, receive before approve, over-receive) |
| anything else | **500** | `INTERNAL_SERVER_ERROR` | see the next list |

Things that land in the 500 row today **(by reading)**:

- **Malformed JSON** on the five handlers that use `parseJsonBody()` (`POST /api/auth/login`, `/api/vendors`, `/api/rfqs`, `/api/purchase-orders`, `/api/reports`). `request.json()` is called at `route.ts:37`, *before* the `try` at `:39`, so the `SyntaxError` is neither a `ZodError` nor an `AppError`. The routes that read the body with `request.json().catch(() => ({}))` (approve, receive, quotes, exports) turn bad JSON into `{}` and then fail Zod validation with a 400 instead.
- **Illegal purchase-order transitions.** `assertPurchaseOrderStatusTransition()` throws a plain `Error` (`purchaseOrderSchemas.ts:92-94`). Approving a PO that is already `APPROVED`, or is `DRAFT`, `RECEIVED`, or `CANCELLED`, therefore returns 500, not 409.
- **Unique-constraint violations (by reading).** A duplicate vendor `code` per tenant (`schema.prisma:167`) or a duplicate `poNumber` per tenant (`:256`) makes Prisma throw `P2002`, which is not mapped.
- **Concurrent demo seeding (by reading).** See finding 2.

Body parsing happens inside the handler, after the permission check. A `VIEWER` posting malformed JSON to `/api/vendors` gets 403, not 400 or 500.

## Route-by-route gates (verified by reading every route file)

| Handler | Wrapper | Permission | Line | Service-level check |
|---|---|---|---|---|
| `POST /api/auth/login` | public | — | `auth/login/route.ts:18` | credentials |
| `POST /api/auth/logout` | public | — | `auth/logout/route.ts:17` | deletes the session row only if the cookie resolves |
| `POST /api/seed-demo` | **public** | — | `seed-demo/route.ts:14` | **none** |
| `GET /api/me` | auth | none | `me/route.ts:13` | — |
| `GET /api/dashboard` | auth | **none** | `dashboard/route.ts:14` | tenant scope only |
| `GET /api/vendors` | auth | `vendor.read` | `vendors/route.ts:34` | tenant scope |
| `POST /api/vendors` | auth | `vendor.write` | `vendors/route.ts:43` | tenant scope; no uniqueness pre-check |
| `GET /api/rfqs` | auth | `rfq.read` | `rfqs/route.ts:42` | tenant scope |
| `POST /api/rfqs` | auth | `rfq.write` | `rfqs/route.ts:51` | tenant scope; RFQ always created `OPEN` |
| `POST /api/rfqs/[rfqId]/quotes` | auth | `rfq.write` | `rfqs/[rfqId]/quotes/route.ts:38` | RFQ and vendor in tenant; RFQ `OPEN` or `DRAFT` |
| `GET /api/purchase-orders` | auth | `purchaseOrder.read` | `purchase-orders/route.ts:36` | tenant scope |
| `POST /api/purchase-orders` | auth | `purchaseOrder.write` | `purchase-orders/route.ts:52` | quote `SUBMITTED` or `SELECTED`, vendor in tenant |
| `POST /api/purchase-orders/[id]/approve` | auth | `purchaseOrder.approve` | `approve/route.ts:37` | transition map only; **no self-approval check** |
| `POST /api/purchase-orders/[id]/receive` | auth | `purchaseOrder.receive` | `receive/route.ts:41` | status `APPROVED`/`PARTIALLY_RECEIVED`, cumulative quantity |
| `GET /api/reports` | auth | `report.read` | `reports/route.ts:45` | tenant scope |
| `POST /api/reports` | auth | `report.manage` | `reports/route.ts:54` | tenant scope |
| `POST /api/reports/[reportId]/exports` | auth | `report.export` | `reports/[reportId]/exports/route.ts:35` | report in tenant |
| `GET /api/export-jobs` | auth | `report.read` | `export-jobs/route.ts:19` | tenant scope |
| `POST /api/export-jobs/run-pending` | auth | `report.export` | `export-jobs/run-pending/route.ts:19` | tenant scope; **no job ownership, no claim** |

That is 19 handlers in 15 route files. Three are public, two are authenticated with no permission, and fourteen name a permission.

## Who holds which permission

The matrix in `authSchemas.ts:49-96`, evaluated through the real `requirePermission()`:

| Permission | ORG_ADMIN | PROCUREMENT_MANAGER | BUYER | AP_CLERK | ANALYST | VIEWER |
|---|---|---|---|---|---|---|
| `vendor.read` | yes | yes | yes | — | — | yes |
| `vendor.write` | yes | yes | — | — | — | — |
| `rfq.read` | yes | yes | yes | — | — | yes |
| `rfq.write` | yes | yes | yes | — | — | — |
| `purchaseOrder.read` | yes | yes | yes | yes | — | yes |
| `purchaseOrder.write` | yes | yes | yes | — | — | — |
| `purchaseOrder.approve` | yes | yes | — | — | — | — |
| `purchaseOrder.receive` | yes | yes | — | yes | — | — |
| `report.read` | yes | yes | yes | yes | yes | yes |
| `report.manage` | yes | — | — | — | yes | — |
| `report.export` | yes | yes | yes | yes | yes | — |
| `audit.read` | yes | — | — | — | yes | — |

`platformRole: "SUPER_ADMIN"` passes every row regardless of membership role.

## Who can call the two "operator" routes

**`POST /api/seed-demo`: anyone, with no cookie at all.** It is wrapped in `withPublicRoute()` (`seed-demo/route.ts:14`), and neither the route nor `seedDemoService.seed()` checks `NODE_ENV` or any flag (`seedDemoService.ts:16-209`). On an empty database it creates two organizations, three users, and demo data. On a seeded database it takes the `alreadySeeded` branch (`:22-30`) and **returns the three email/password/slug triples in plain text**, including the `ORG_ADMIN` login. In any deployment where the seed has run, one anonymous POST yields a working admin credential for `acme-industrial`. The route's own senior note (`:19-20`) says production systems "should gate this", and nothing does. (by reading)

**`POST /api/export-jobs/run-pending`: any member with `report.export`.** That is `ORG_ADMIN`, `PROCUREMENT_MANAGER`, `BUYER`, `AP_CLERK`, and `ANALYST`: every role except `VIEWER`. The route has no notion of an operator. It processes up to 10 pending jobs for the caller's tenant (`exportJobService.ts:68`), including jobs other users queued, and records the *runner* as `actorUserId` on the `exportJob.completed` audit row (`:100-107`), not the requester. Isolation between tenants holds (the batch read is tenant-scoped), but within a tenant it is "whoever clicks first".

## Purchase-order approval controls

| Control | Present? | Evidence |
|---|---|---|
| Approver must hold `purchaseOrder.approve` | yes | `approve/route.ts:37` |
| Approver identity taken from the session, not the body | yes | `approve/route.ts:26` overwrites `approverUserId`; the service uses `session.userId` (`purchaseOrderService.ts:134`) |
| PO must be in the caller's tenant | yes | `findById(session.tenantId, ...)` (`:125`) → 404 |
| PO must be `PENDING_APPROVAL` | yes, but → **500** on violation | `:131` + plain `Error` at `purchaseOrderSchemas.ts:93` |
| Approver must differ from requester | **no** | `requestedById` is never read in `approvePurchaseOrder()` (`:124-156`). A `PROCUREMENT_MANAGER` can create a PO and approve it |
| Only one approval wins under concurrency | **no** | status checked at `:131` outside the transaction; `approve()` updates `where: { id, tenantId }` with no status predicate (`purchaseOrderRepository.ts:99-109`). Two overlapping approvals both return 200 and write two audit rows; the later write wins `approvedById` |
| Amount limits / approval tiers | no | no amount is consulted |
| Body `notes` stored | no | `notes` is validated (`purchaseOrderSchemas.ts:48`) and then discarded |

## Receiving controls

| Control | Present? | Evidence |
|---|---|---|
| Requires `purchaseOrder.receive` | yes | `receive/route.ts:41` |
| Receive before approve rejected | yes, **409** | `purchaseOrderService.ts:182-187` |
| Line items must belong to the PO | yes | `:204-209` → 409 |
| Cumulative quantity across earlier receipts | yes | `:211-220` (by reading: 100 received + 21 more of 120 → 409) |
| Same line item twice in one payload | **not caught** | the check compares each entry to *prior* receipts only. Two entries of 120 for a 120-unit line pass, 240 is recorded, and the PO becomes `RECEIVED` |
| Discrepancy line items must belong to the PO | **no** | discrepancies are never checked against `orderedLineItems`. Any `PurchaseOrderLineItem` id, including another tenant's, is written into `Discrepancy.purchaseOrderLineItemId` (`purchaseOrderRepository.ts:163-169`) |
| A second partial receipt | **rejected with 500** | `PARTIALLY_RECEIVED → PARTIALLY_RECEIVED` is not in the transition map, and the guard at `:241` runs unconditionally. See `docs/architecture/domain-model.md` |
| Concurrent receipts serialized | **no** | prior receipts are loaded at `:176` outside the transaction at `:243` (by reading; same shape as the approval race) |

## Unused authorization code

| Symbol | Defined | Callers outside tests |
|---|---|---|
| `hasPermission()` | `permissions.ts:38-48` | none |
| `assertTenantScope()` | `authSchemas.ts:123-130` | none (only `src/test/tenant-isolation.test.ts`) |
| `sessionClaimsSchema` | `authSchemas.ts:26-32` | none |
| `audit.read` permission | `authSchemas.ts:46` | no route checks it, and there is no audit-log read route |
| `authRepository.countOrganizations()` | `authRepository.ts:69-71` | none |

`AppPermission` in `permissions.ts:19-31` re-lists the twelve permission strings as a TypeScript union. That is a second copy of `permissionActionSchema` (`authSchemas.ts:34-47`). Today the two lists match. Nothing ties them together.

## Findings

1. **Self-approval is allowed.** Fix: in `approvePurchaseOrder()`, throw `ForbiddenError` when `purchaseOrder.requestedById === session.userId`. The field is already loaded by `findById()`.
2. **`/api/seed-demo` is anonymous and leaks credentials.** Fix: return 404 unless an explicit `ENABLE_DEMO_SEED` flag is set, and never return passwords from the `alreadySeeded` branch. Concurrent first-time seeds also race: both see no `acme-industrial` organization at `:18-20`, both open a transaction, and the second fails on the unique `slug` (`schema.prisma:90`) with an unmapped Prisma error, so 500 (by reading).
3. **Double approval races and illegal transitions return 500.** Fix: make the guard part of the write: `updateMany({ where: { id, tenantId, status: "PENDING_APPROVAL" } })` and treat `count === 0` as `ConflictError`. Separately, make `assertPurchaseOrderStatusTransition()` throw `ConflictError` so the sequential case is a 409.
4. **Export jobs can run twice.** Two overlapping `run-pending` calls both read the same `PENDING` rows, both mark them `RUNNING`, both build rows, and both mark them `SUCCEEDED`, producing two `exportJob.completed` audit rows (by reading; observed transitions `j1:RUNNING j1:RUNNING j1:SUCCEEDED j1:SUCCEEDED`). Fix: claim each job with `updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING" } })` and skip it when `count === 0`.
5. **Receiving accepts duplicate line entries and foreign discrepancy line items.** Fix: aggregate `input.lineItems` by `purchaseOrderLineItemId` before the cumulative check, and run discrepancy IDs through the same `orderedLineItems` lookup.
6. **Export-job state writes are not tenant-scoped.** See the correction above. Fix: add `tenantId` to the `where` of the three `mark*` methods so the repository is safe to call from a future worker.
7. **`GET /api/dashboard` has no permission.** An `ANALYST`, who lacks `purchaseOrder.read`, still sees the five most recent PO numbers, vendors, and statuses through `dashboard/route.ts:18-29`. The same analyst also gets PO rows through `PROCUREMENT_SPEND` exports. Decide whether analysts should see PO data, then make the dashboard and the matrix agree.
8. **Malformed JSON is a 500** on the `parseJsonBody()` routes. Fix: move `await request.json()` inside the `try` and map `SyntaxError` to `ValidationBoundaryError`.
9. **A PO cannot take a second partial receipt**. This is a workflow bug, not a permission bug, but it surfaces as a 500 on a permission-gated route, so it is listed here too.

## Debugging scenarios

- **"Login returns 400 with a valid password."** The schema demands at least 12 characters (`authSchemas.ts:22`). The 400 message is Zod's first issue.
- **"Login returns 500."** The body is not valid JSON, which is the `parseJsonBody()` path above.
- **"Logged in, but every API call is 401."** The cookie is `secure` only in production. If you run `next start` with `NODE_ENV=production` over plain HTTP, the browser drops the cookie. Also check that `SESSION_SECRET` did not change between login and the request, because a changed secret fails JWT verification and every session resolves to `null`.
- **"Analyst sees purchase orders that do not exist."** `GET /api/purchase-orders` returns 403 for `ANALYST`, and `use-purchase-orders-data.ts:64-75` swallows any non-OK response and returns hard-coded `fallbackPurchaseOrders` (`PO-1048`, `PO-1041`, `PO-1035`). Every data hook does the same. A permission error looks like real data.
- **"Approving the same PO twice gives a 500."** That is finding 3. The server log will show `Invalid purchase order transition from APPROVED to APPROVED`.
- **"An export job ran twice."** Look for two `exportJob.completed` audit rows with the same `entityId`. That is finding 4.
- **"User removed from the organization can still use the app."** They cannot. Membership is reloaded on every request, and a missing membership resolves to `null`. If they can, check that the membership row was actually deleted and not moved to another organization.
