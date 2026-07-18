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
- `src/repositories/reportRepository.ts` and `src/repositories/exportJobRepository.ts` scope report definitions and export jobs by `tenantId`.
- `src/repositories/dashboardRepository.ts` scopes dashboard counts and analytics datasets by `tenantId`.

What would need to change to support platform-level admin features beyond the current design:

- Add platform-admin-only routes under `src/app/api/admin/**`.
- Keep `PlatformRole` checks in `src/lib/auth/permissions.ts` separate from organization membership rules.
- Continue requiring repository methods to accept `tenantId` for tenant-owned data, even when the caller is a platform admin, so elevated access stays explicit instead of becoming an accidental default.
