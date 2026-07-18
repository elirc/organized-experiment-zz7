# Request Lifecycle

Request: Log in to an organization workspace
1. `src/app/api/auth/login/route.ts` — parses the login body with `loginRequestSchema` and calls `authService.login()`.
2. `src/lib/validation/authSchemas.ts` — `loginRequestSchema.parse()` validates email, password, and `organizationSlug`.
3. `src/services/authService.ts` — `authService.login()` verifies the password and creates a revocable session.
4. `src/repositories/authRepository.ts` — `findMembershipByEmailAndOrganizationSlug()` loads the user-membership-org tuple and `createSession()` persists the hashed session token.
5. `src/lib/auth/session.ts` — `signSessionToken()` signs the cookie payload and `hashSessionToken()` protects the DB-stored token value.
6. Returns `200` with `{ session }` and sets the `procureflow_session` cookie.

Request: Create a vendor
1. `src/app/api/vendors/route.ts` — `POST` enters through `withRouteAuth()` with `"vendor.write"`.
2. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and fires `assertPermission()`.
3. `src/lib/validation/vendorSchemas.ts` — `vendorCreateSchema.parse()` validates name, code, status, payment terms, country, and contact email.
4. `src/services/vendorService.ts` — `createVendor()` adds the vendor and writes an audit log.
5. `src/repositories/vendorRepository.ts` — `create()` writes the vendor row with `tenantId`.
6. `src/repositories/auditLogRepository.ts` — `create()` stores the `vendor.created` audit event.
7. Returns `201` with the created vendor shape.

Request: Receive an approved purchase order
1. `src/app/api/purchase-orders/[purchaseOrderId]/receive/route.ts` — `POST` binds the route param, injects `receivedById` from the session, and validates the merged payload.
2. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and requires `"purchaseOrder.receive"`.
3. `src/lib/validation/purchaseOrderSchemas.ts` — `purchaseOrderReceiveSchema.parse()` validates line items, discrepancies, and receipt metadata.
4. `src/services/purchaseOrderService.ts` — `receivePurchaseOrder()` loads the PO, validates cumulative received quantities, computes the next status, and writes the receipt in a transaction.
5. `src/repositories/purchaseOrderRepository.ts` — `findById()`, `createReceipt()`, and `updateStatus()` issue the tenant-scoped database queries.
6. `src/repositories/auditLogRepository.ts` — `create()` stores the `purchaseOrder.received` audit event.
7. Returns `200` with the refreshed purchase-order shape.

Request: Queue and process a report export
1. `src/app/api/reports/[reportId]/exports/route.ts` — `POST` binds the route param, validates the export request, and calls `exportJobService.createExportJob()`.
2. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and requires `"report.export"`.
3. `src/lib/validation/reportSchemas.ts` — `reportExportRequestSchema.parse()` validates the requested export format.
4. `src/services/exportJobService.ts` — `createExportJob()` loads the saved report and writes a pending export job.
5. `src/repositories/reportRepository.ts` — `findDefinitionById()` loads the tenant-scoped report definition.
6. `src/repositories/exportJobRepository.ts` — `create()` persists the pending job.
7. Returns `201` with the queued export job.

Request: Reject an unauthorized approval attempt
1. `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts` — `POST` enters through `withRouteAuth()` with `"purchaseOrder.approve"`.
2. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and calls `assertPermission()`.
3. `src/lib/auth/permissions.ts` — `assertPermission()` delegates to `requirePermission()` from `src/lib/validation/authSchemas.ts`.
4. `src/lib/validation/authSchemas.ts` — `requirePermission()` throws `AuthorizationError` when the membership role cannot approve purchase orders.
5. `src/lib/http/route.ts` — `handleRouteError()` converts the failure into JSON.
6. Returns `403` with `{ error: "FORBIDDEN", message }`.
