# Flow Traces

## Flow: Login And Session Cookie
1. `src/components/auth/login-page.tsx` — `handleSubmit()` sends `POST /api/auth/login`.
2. `src/app/api/auth/login/route.ts` — parses the request and calls `authService.login()`.
3. `src/lib/validation/authSchemas.ts` — `loginRequestSchema.parse()` validates the payload.
4. `src/services/authService.ts` — `authService.login()` verifies the password and creates the session.
5. `src/repositories/authRepository.ts` — `findMembershipByEmailAndOrganizationSlug()` loads the membership and `createSession()` stores the hashed token.
6. `src/lib/auth/session.ts` — `signSessionToken()` signs the cookie payload.
7. Returns `{ session }` and sets the cookie.

## Flow: Create Vendor
1. `src/components/vendors/vendors-page.tsx` — the page reads vendor data now, and a future create form would submit `POST /api/vendors`.
2. `src/app/api/vendors/route.ts` — protected `POST` route enters `withRouteAuth()`.
3. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and checks `"vendor.write"`.
4. `src/lib/validation/vendorSchemas.ts` — `vendorCreateSchema.parse()` validates vendor input.
5. `src/services/vendorService.ts` — `createVendor()` writes the vendor and audit event.
6. `src/repositories/vendorRepository.ts` — `create()` writes the tenant-scoped vendor row.
7. `src/repositories/auditLogRepository.ts` — `create()` records `vendor.created`.
8. Returns the vendor payload.

## Flow: Convert Quote Into Purchase Order
1. `src/app/api/purchase-orders/route.ts` — `POST` accepts the PO request and calls `purchaseOrderService.createPurchaseOrder()`.
2. `src/lib/http/route.ts` — `withRouteAuth()` checks `"purchaseOrder.write"`.
3. `src/lib/validation/purchaseOrderSchemas.ts` — `purchaseOrderCreateSchema.parse()` validates PO input.
4. `src/services/purchaseOrderService.ts` — `createPurchaseOrder()` optionally loads the quote, selects it, awards the RFQ, and creates the PO in one transaction.
5. `src/repositories/sourcingRepository.ts` — `findQuoteById()` and `selectQuoteAndAwardRfq()` handle the sourcing side of the transition.
6. `src/repositories/purchaseOrderRepository.ts` — `create()` persists the PO and its line items.
7. `src/repositories/auditLogRepository.ts` — `create()` writes `purchaseOrder.created`.
8. Returns the created PO.

## Flow: Reject Unauthorized Approval
1. `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts` — `POST` enters the protected route.
2. `src/lib/http/route.ts` — `withRouteAuth()` calls `assertPermission()`.
3. `src/lib/auth/permissions.ts` — `assertPermission()` delegates to `requirePermission()`.
4. `src/lib/validation/authSchemas.ts` — `requirePermission()` throws when the membership role lacks `"purchaseOrder.approve"`.
5. `src/lib/http/route.ts` — `handleRouteError()` turns the failure into a `403`.
6. Returns `{ error: "FORBIDDEN", message }`.

## Flow: Receive Purchase Order With Discrepancy
1. `src/app/api/purchase-orders/[purchaseOrderId]/receive/route.ts` — merges route/session values into the receipt body and validates it.
2. `src/lib/validation/purchaseOrderSchemas.ts` — `purchaseOrderReceiveSchema.parse()` validates receipt line items and discrepancies.
3. `src/services/purchaseOrderService.ts` — `receivePurchaseOrder()` loads the PO, validates cumulative quantity, computes the next status, and starts a transaction.
4. `src/repositories/purchaseOrderRepository.ts` — `findById()` loads line items and prior receipts.
5. `src/repositories/purchaseOrderRepository.ts` — `createReceipt()` writes receipt rows and discrepancy rows.
6. `src/repositories/purchaseOrderRepository.ts` — `updateStatus()` advances the PO to `PARTIALLY_RECEIVED` or `RECEIVED`.
7. `src/repositories/auditLogRepository.ts` — `create()` stores `purchaseOrder.received`.
8. Returns the refreshed PO.

## Flow: Queue And Run Export Job
1. `src/app/api/reports/[reportId]/exports/route.ts` — `POST` queues the export job.
2. `src/services/exportJobService.ts` — `createExportJob()` loads the report definition and writes a pending job.
3. `src/repositories/reportRepository.ts` — `findDefinitionById()` loads the saved report.
4. `src/repositories/exportJobRepository.ts` — `create()` stores the pending export.
5. `src/app/api/export-jobs/run-pending/route.ts` — `POST` triggers processing for the current tenant.
6. `src/services/exportJobService.ts` — `runPendingJobs()` marks jobs running, builds rows, and marks jobs complete or failed.
7. `src/repositories/dashboardRepository.ts` — `buildRowsForReport()` produces the analytics dataset.
8. `src/repositories/exportJobRepository.ts` — `markRunning()` and `markSucceeded()` advance async state.
