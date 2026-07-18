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
