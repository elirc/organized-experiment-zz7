# Load-Bearing Files

- `src/lib/http/route.ts`
  What it does: Central route wrapper for auth, validation parsing, and error serialization.
  What calls it: Every API file under `src/app/api/**`.
  What it calls: `src/services/authService.ts`, `src/lib/auth/permissions.ts`, and Zod.
  What would break or become insecure if this file were wrong: Routes would drift on auth and error behavior, and some protected endpoints would become easier to miss.
  What a junior engineer would likely miswrite here: Per-route try/catch and auth logic instead of one reviewed wrapper.

- `src/services/authService.ts`
  What it does: Logs users in, resolves signed-cookie sessions, and revokes sessions on logout.
  What calls it: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/lib/http/route.ts`, `src/lib/auth/page-session.ts`.
  What it calls: `src/repositories/authRepository.ts`, `src/lib/auth/session.ts`, `src/lib/auth/password.ts`.
  What would break or become insecure if this file were wrong: Users could keep stale sessions, bypass revocation, or cross tenant boundaries with a bad membership lookup.
  What a junior engineer would likely miswrite here: Trusting the JWT without confirming the backing DB session row.

- `src/services/purchaseOrderService.ts`
  What it does: Owns PO creation, approval, and receiving state transitions.
  What calls it: `src/app/api/purchase-orders/route.ts`, `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts`, `src/app/api/purchase-orders/[purchaseOrderId]/receive/route.ts`.
  What it calls: `src/repositories/purchaseOrderRepository.ts`, `src/repositories/sourcingRepository.ts`, `src/repositories/auditLogRepository.ts`, `src/lib/validation/purchaseOrderSchemas.ts`.
  What would break or become insecure if this file were wrong: Invalid PO state transitions, over-receiving inventory, or missing audit trails.
  What a junior engineer would likely miswrite here: Updating status directly without validating cumulative receipt quantity.

- `src/repositories/purchaseOrderRepository.ts`
  What it does: Issues tenant-scoped PO, receipt, and status update queries.
  What calls it: `src/services/purchaseOrderService.ts`.
  What it calls: Prisma.
  What would break or become insecure if this file were wrong: Cross-tenant PO leaks or workflow writes against the wrong tenant’s records.
  What a junior engineer would likely miswrite here: Looking up purchase orders by `id` only.

- `src/services/exportJobService.ts`
  What it does: Queues export jobs and processes pending jobs for one tenant.
  What calls it: `src/app/api/reports/[reportId]/exports/route.ts`, `src/app/api/export-jobs/run-pending/route.ts`.
  What it calls: `src/repositories/exportJobRepository.ts`, `src/repositories/reportRepository.ts`, `src/repositories/dashboardRepository.ts`, `src/repositories/auditLogRepository.ts`.
  What would break or become insecure if this file were wrong: Duplicate exports, incorrect report snapshots, or tenant-mixed async processing.
  What a junior engineer would likely miswrite here: Doing the export synchronously in the queueing route.

- `src/repositories/dashboardRepository.ts`
  What it does: Builds dashboard KPIs and report/export read rows.
  What calls it: `src/services/dashboardService.ts`, `src/services/exportJobService.ts`.
  What it calls: Prisma.
  What would break or become insecure if this file were wrong: The dashboard and analytics layer would either leak rows across tenants or move aggregation logic into React.
  What a junior engineer would likely miswrite here: Returning raw transactional rows and making the client aggregate.

- `src/lib/validation/authSchemas.ts`
  What it does: Defines login validation, permission vocabulary, tenant-scope guard, and auth test helpers.
  What calls it: `src/lib/auth/permissions.ts`, `src/app/api/auth/login/route.ts`, tests in `src/test/auth-permissions.test.ts` and `src/test/tenant-isolation.test.ts`.
  What it calls: Zod only.
  What would break or become insecure if this file were wrong: Role checks would drift or the route layer would validate different auth shapes from the tests.
  What a junior engineer would likely miswrite here: Treating permission strings as informal conventions instead of a contract.

- `src/components/auth/login-page.tsx`
  What it does: Teaches the browser-side request flow into seeding and login.
  What calls it: `src/app/login/page.tsx`.
  What it calls: `/api/seed-demo` and `/api/auth/login`.
  What would break or become insecure if this file were wrong: The app would stop demonstrating the real session path and regress into fake local auth.
  What a junior engineer would likely miswrite here: Simulating login by pushing to `/` without calling the route.

**Corrections to the entries above:**

- `src/lib/http/route.ts` — "What calls it: Every API file" is correct: all 15 route files use `withRouteAuth()` or `withPublicRoute()`. "Validation parsing" is partial: only five handlers use `parseJsonBody()`; the approve, receive, quotes, and exports routes call `schema.parse()` themselves and rely on `handleRouteError()` to map the `ZodError`. And `parseJsonBody()` reads the body outside its `try`, so malformed JSON is a 500 (`route.ts:37`; run).
- `src/services/purchaseOrderService.ts` — "What it calls" also includes `src/repositories/vendorRepository.ts` (`:76`) and `prisma` directly for transactions (`:43`, `:133`, `:243`). "What would break ... over-receiving inventory" has already partly happened: duplicate entries in one payload over-receive.
- `src/services/exportJobService.ts` — "Duplicate exports" is not hypothetical; two overlapping `run-pending` calls do it. "Incorrect report snapshots" also already happens: processing ignores the queued snapshot and overwrites it (`:75`, `:94-97`).
- `src/lib/validation/authSchemas.ts` — "What calls it" omits that its `assertTenantScope()` is called only by a test. The "tenant-scope guard" it lists is not part of any request path.

## Files that are load-bearing but were missing from this list

- `src/lib/validation/purchaseOrderSchemas.ts`
  What it does: Zod schemas for PO create, approve, and receive, plus `purchaseOrderTransitionMap` and `assertPurchaseOrderStatusTransition()` (`:75-97`).
  What calls it: the three PO routes and `purchaseOrderService.ts` (`:131`, `:241`).
  What would break if it were wrong: it already is, in one place. The map lacks `PARTIALLY_RECEIVED → PARTIALLY_RECEIVED`, so a second partial receipt fails. And the guard throws a plain `Error`, so every illegal transition is a 500.
  What a junior engineer would likely miswrite here: a transition map that lists only the "interesting" edges and forgets the self-loops the service produces.

- `src/repositories/exportJobRepository.ts`
  What it does: creates jobs, reads the pending batch, and moves jobs through `RUNNING`, `SUCCEEDED`, `FAILED`.
  What calls it: `exportJobService.ts` only.
  What would break if it were wrong: the `mark*` methods update by `id` alone (`:71-107`), with neither a status condition nor a tenant condition. That is the root of the double-run race and a latent cross-tenant write if a future caller passes an unscoped ID.
  What a junior engineer would likely miswrite here: a "claim" step that is really a read followed by an unconditional write.

- `src/services/seedDemoService.ts` and `src/app/api/seed-demo/route.ts`
  What they do: create the demo tenants, users, and data; return the credentials.
  What calls them: the login page's seed button.
  What would break if they were wrong: they are the only way to get users into an empty database, because there is no sign-up route and no seed script. They are also public and return the admin password (`seedDemoService.ts:22-30`).
  What a junior engineer would likely miswrite here: a setup endpoint with no environment gate.

- `src/lib/env.ts`
  What it does: reads `SESSION_SECRET` with a fixed fallback (`:15-16`).
  What calls it: `src/lib/auth/session.ts:18`. Despite its header, `src/lib/prisma/client.ts` does not use it, and `env.databaseUrl` and `env.nodeEnv` are never read.
  What would break if it were wrong: every session signature depends on it. Changing the secret logs everyone out, because every JWT then fails verification.

- `src/hooks/use-*-data.ts` (five files)
  What they do: fetch one endpoint each through React Query.
  What would break if they were wrong: they are already wrong in one way. Each swallows every error and returns hard-coded sample data, so 401, 403, and 500 all render as plausible content.

- `src/repositories/sourcingRepository.ts`
  What it does: RFQ and quote persistence, including `selectQuoteAndAwardRfq()` (`:153-192`), a three-statement transition run inside the PO-create transaction.
  What would break if it were wrong: quote selection would leave sibling quotes `SUBMITTED` or the RFQ `OPEN`. Its `findQuoteById()` cannot join a transaction (`:134-151`), which is why the quote status check in `createPurchaseOrder()` is outside it.
