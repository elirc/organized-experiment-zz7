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

**Corrections to the flows above** (each checked against the code):

- *Login, step 2-3:* the route parses with `parseJsonBody()` (`login/route.ts:19`). If the body is not valid JSON, the flow ends at step 2 with a 500, not a 400.
- *Create vendor, step 3-4:* the permission check (step 3) runs before the schema parse (step 4), so a `VIEWER` with a bad payload sees 403, not 400. A duplicate vendor `code` passes step 4 and fails in step 6 as an unmapped Prisma error → 500 (by reading).
- *Convert quote, step 4:* the writes share a transaction; the quote read does not (`sourcingRepository.ts:134-151` has no `client` parameter). The body's `vendorId`, `currency`, and `lineItems` are required by the schema and then replaced with the quote's. Converting the same quote again succeeds.
- *Reject unauthorized approval:* accurate. The interesting rejection paths are the ones that do *not* happen: a requester approving their own PO is accepted.
- *Receive with discrepancy, steps 3-6:* step 4 (`findById()`) happens before step 3's checks, not after. The discrepancy rows in step 5 are written without checking that their line items belong to this PO. If the PO was already `PARTIALLY_RECEIVED` and this receipt does not complete it, the flow stops at step 3 with a 500.
- *Queue and run export, step 6:* "marks jobs running ... complete or failed" is accurate, but nothing prevents two requests from doing it to the same job at once. Step 7 uses the report definition as it is *now*, not the snapshot stored at step 4.

---

## Flow: Approve A Purchase Order (happy path)

1. `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts:15` — `POST` enters `withRouteAuth()`.
2. `src/lib/http/route.ts:77-82` — session, then `"purchaseOrder.approve"` (`ORG_ADMIN` or `PROCUREMENT_MANAGER`).
3. `approve/route.ts:21-28` — reads the param, reads the body leniently, and validates a merged object whose result is thrown away.
4. `src/services/purchaseOrderService.ts:125-131` — loads the PO in the tenant (404 otherwise) and checks the transition (500 for anything but `PENDING_APPROVAL`).
5. `purchaseOrderService.ts:133-147` — one transaction: `purchaseOrderRepository.approve()` then the `purchaseOrder.approved` audit row.
6. `purchaseOrderService.ts:149-155` — reloads and serializes.
7. Returns `200` with the PO.

No UI calls this route. Try it with `curl` or the browser console while logged in as Olivia or Marco, against a PO you created with `POST /api/purchase-orders` (the seeded `PO-24017` is already approved, so approving it returns 500).

## Flow: Seed The Demo

1. `src/components/auth/login-page.tsx:35-58` — `handleSeedDemo()` posts to `/api/seed-demo` with no body.
2. `src/app/api/seed-demo/route.ts:14-17` — `withPublicRoute()`; no session.
3. `src/services/seedDemoService.ts:18-31` — if `acme-industrial` exists, return the credentials immediately.
4. `seedDemoService.ts:33-199` — otherwise hash the password and create both tenants and their data in one transaction.
5. `login-page.tsx:44-52` — copy the first credential into the form and show "Demo workspace created." or "already seeded".

If the request fails with a non-JSON body (for example a 500 HTML page), `response.json()` throws and the user sees "Unable to seed demo data." (`login-page.tsx:53-54`). If it fails with a JSON error body, `result.credentials` is undefined and `result.credentials[0]` throws a `TypeError`, which lands in the same catch.

## Flow: Dashboard Read

1. `src/app/page.tsx:12` — `requirePageSession()` redirects to `/login` without a valid session.
2. `src/components/dashboard/dashboard-page.tsx` → `src/hooks/use-dashboard-data.ts:75-87` — fetch `/api/dashboard`; on any error return `fallbackDashboard`.
3. `src/app/api/dashboard/route.ts:14` — `withRouteAuth()` with **no permission**.
4. `src/services/dashboardService.ts:15-39` → `src/repositories/dashboardRepository.ts:68-126` — five tenant-scoped counts in parallel, then the five newest POs.
5. `dashboard/route.ts:17-73` — shapes tiles. "Open approvals" is the count of `PENDING_APPROVAL`, `APPROVED`, and `PARTIALLY_RECEIVED` POs (`dashboardRepository.ts:82-93`), so it includes POs that are already approved.

## Flow: Log Out

1. `src/components/layout/app-shell.tsx:46-52` — `handleLogout()` posts to `/api/auth/logout`, then navigates to `/login`.
2. `src/app/api/auth/logout/route.ts:17-18` — public route; passes the cookie value to `authService.logout()`.
3. `src/services/authService.ts:86-96` — resolves the session; if it resolves, `deleteSessionById()` (`authRepository.ts:63-67`, `deleteMany`).
4. `logout/route.ts:20-28` — clears the cookie, returns `{ ok: true }`.

The client ignores the response, so a failed logout still navigates to `/login` while the cookie may remain valid.

## Flow: How A Saved Report's Filters Reach An Export

This is where the date-filter defect lives, so it is traced in full.

1. `POST /api/reports` → `parseJsonBody(request, reportDefinitionSchema)` (`reports/route.ts:50`). `reportFilterSchema` coerces `dateFrom` and `dateTo` to `Date` objects (`reportSchemas.ts:39-40`).
2. `reportService.createReport()` spreads the parsed input into `reportRepository.createDefinition()` (`reportService.ts:40-44`). `filters` is a `Json` column (`schema.prisma:326`). JSON has no date type, so the `Date` objects are stored as ISO strings.
3. `POST /api/reports/[reportId]/exports` copies `filters` into the job's `snapshot` (`exportJobService.ts:41-46`).
4. `POST /api/export-jobs/run-pending` reads `pendingJob.reportDefinition.filters` (`exportJobService.ts:75-82`), not the snapshot. The TypeScript cast says `dateFrom?: Date`, but at runtime it is a string.
5. `applyFilters()` (`dashboardRepository.ts:55-61`) evaluates `new Date(row.dateValue) < filters.dateFrom`. Comparing a `Date` with a string converts both to numbers; the ISO string becomes `NaN`, and every comparison with `NaN` is `false`. No row is ever excluded by date.
6. Other filters behave differently. `minAmount` survives JSON as a number and works. `vendorIds`, `purchaseOrderStatuses`, and `currencies` are string arrays and work, but only when the row has the field: `VENDOR_PERFORMANCE` rows have no `status`, `currency`, `totalAmount`, or `dateValue` (`dashboardRepository.ts:172-177`), so those filters are silently skipped for that report type, and `RECEIVING_DISCREPANCY` rows have no `vendorId` or `totalAmount`.
7. `CUSTOM` and `PURCHASE_ORDER_PIPELINE` both fall through to the final branch (`dashboardRepository.ts:213-233`): all POs in the tenant, newest first.

Fix sketch: in `runPendingJobs()`, parse the stored filters with `reportFilterSchema` (which coerces strings back to `Date`) before calling `buildRowsForReport()`, and read them from the queued `snapshot`.
