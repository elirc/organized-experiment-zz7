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

**Correction on order and scope:** `withRouteAuth()` (step 2) runs before the route body (step 1). The session and the `purchaseOrder.receive` permission are checked first, and only then does the handler read the body and merge in the route param. The route also computes a receipt `status` from the body (`receive/route.ts:27-30`) only to satisfy the schema; the service recomputes it independently (`purchaseOrderService.ts:252-255`). Step 4's "validates cumulative received quantities" holds across earlier receipts, but not across duplicate entries inside one payload. And the trace only succeeds for a PO that is `APPROVED`, or `PARTIALLY_RECEIVED` with this receipt completing every line. A second partial receipt fails with 500. See "Receiving, line by line" below.

Request: Queue and process a report export
1. `src/app/api/reports/[reportId]/exports/route.ts` — `POST` binds the route param, validates the export request, and calls `exportJobService.createExportJob()`.
2. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and requires `"report.export"`.
3. `src/lib/validation/reportSchemas.ts` — `reportExportRequestSchema.parse()` validates the requested export format.
4. `src/services/exportJobService.ts` — `createExportJob()` loads the saved report and writes a pending export job.
5. `src/repositories/reportRepository.ts` — `findDefinitionById()` loads the tenant-scoped report definition.
6. `src/repositories/exportJobRepository.ts` — `create()` persists the pending job.
7. Returns `201` with the queued export job.

**Correction on order:** as above, `withRouteAuth()` (step 2) runs before the handler (step 1). Step 3 validates more than the format: the merged object must also carry `reportDefinitionId` and `requestedById`, which the route fills from the URL and the session (`reports/[reportId]/exports/route.ts:23-27`). Any `format` other than `"CSV"` or `"JSON"`, including a missing one, is a `ZodError` → 400. The trace also stops at queueing. Nothing runs the job until someone calls `POST /api/export-jobs/run-pending`; there is no worker or cron in the repo. The "Queue export" button in `src/components/reports/reports-page.tsx:168-174` does not call this route at all; it only logs to the browser console.

Request: Reject an unauthorized approval attempt
1. `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts` — `POST` enters through `withRouteAuth()` with `"purchaseOrder.approve"`.
2. `src/lib/http/route.ts` — `withRouteAuth()` resolves the session and calls `assertPermission()`.
3. `src/lib/auth/permissions.ts` — `assertPermission()` delegates to `requirePermission()` from `src/lib/validation/authSchemas.ts`.
4. `src/lib/validation/authSchemas.ts` — `requirePermission()` throws `AuthorizationError` when the membership role cannot approve purchase orders.
5. `src/lib/http/route.ts` — `handleRouteError()` converts the failure into JSON.
6. Returns `403` with `{ error: "FORBIDDEN", message }`.

This trace is accurate. The `message` is `"Role VIEWER cannot perform purchaseOrder.approve"` for a viewer (`authSchemas.ts:117`, rethrown as `ForbiddenError` with the same text at `permissions.ts:54-56`), so the response names the caller's role and the permission.

---

## Line-anchored traces

Labels: every row was traced in the source only (**by reading**); nothing was executed.

### Approve a pending purchase order (happy path)

| # | Location | What happens |
|---|---|---|
| 1 | `src/lib/http/route.ts:77` | resolve the session from the `procureflow_session` cookie, or 401 |
| 2 | `route.ts:79-82` → `permissions.ts:50-60` | `purchaseOrder.approve`, or 403. Only `ORG_ADMIN` and `PROCUREMENT_MANAGER` pass |
| 3 | `approve/route.ts:21` | `await context.params` → `purchaseOrderId` |
| 4 | `:22` | `request.json().catch(() => ({}))`, so an empty or broken body becomes `{}` |
| 5 | `:23-28` | `purchaseOrderApproveSchema.parse({ ...body, approvedAt: new Date(), approverUserId: session.userId, purchaseOrderId })`. The return value is discarded. The only way this parse can fail is a `notes` string over 2000 characters → 400 |
| 6 | `purchaseOrderService.ts:125-129` | `findById(session.tenantId, id)`, or 404 `"Purchase order was not found."` (also for another tenant's PO) |
| 7 | `:131` | `assertPurchaseOrderStatusTransition(status, "APPROVED")`. Anything but `PENDING_APPROVAL` → plain `Error` → **500** |
| 8 | `:133-147` | transaction: `approve()` sets `status`, `approvedAt`, `approvedById` with `where: { id, tenantId }` (`purchaseOrderRepository.ts:99-109`), then the `purchaseOrder.approved` audit row with `fromStatus`/`toStatus` |
| 9 | `:149-155` | re-read the PO and serialize it |
| 10 | `route.ts:35` | `200` with the serialized PO |

Nothing compares `session.userId` with the PO's `requestedById`, so the requester can approve their own order.

### Create a purchase order from a quote

| # | Location | What happens |
|---|---|---|
| 1 | `route.ts:77-82` | session + `purchaseOrder.write` (`ORG_ADMIN`, `PROCUREMENT_MANAGER`, `BUYER`) |
| 2 | `purchase-orders/route.ts:41` | `parseJsonBody(request, purchaseOrderCreateSchema)`. **`vendorId`, `currency`, and at least one line item are required even when `quoteId` is sent** (`purchaseOrderSchemas.ts:35-42`) |
| 3 | `purchaseOrderService.ts:43` | open a transaction |
| 4 | `:50-54` | `findQuoteById(tenantId, quoteId)` using the global client, not `tx`; missing → 404 |
| 5 | `:56-58` | quote must be `SUBMITTED` or `SELECTED`, else 409 |
| 6 | `:60-65` | `selectQuoteAndAwardRfq()`: all quotes on the RFQ → `REJECTED`, this one → `SELECTED`, RFQ → `AWARDED` |
| 7 | `:67-74` | **the body's `vendorId`, `currency`, and `lineItems` are replaced** by the quote's (by reading: a body with `EUR` and 999 units produced a `USD` PO with the quote's 2 units) |
| 8 | `:83-106` | total computed, PO created as `PENDING_APPROVAL` with `submittedAt: now` |
| 9 | `:108-118` | `purchaseOrder.created` audit row in the same transaction |
| 10 | `route.ts:50` | `201` |

Repeat the same request with a new `poNumber` and you get a second PO from the same quote, because the quote is now `SELECTED`, which step 5 accepts. Repeat it with the *same* `poNumber` and the unique constraint fails → 500 (by reading).

### Submit a quote to an RFQ

| # | Location | What happens |
|---|---|---|
| 1 | `route.ts:77-82` | session + `rfq.write` |
| 2 | `quotes/route.ts:22-28` | parse `{ ...body, rfqId, submittedById: session.userId, totalAmount: 0 }`; any client `totalAmount` is overwritten with 0 |
| 3 | `sourcingService.ts:76-79` | load the RFQ and the vendor in parallel, both tenant-scoped |
| 4 | `:81-87` | 404 for either missing |
| 5 | `:89-91` | RFQ must be `OPEN` or `DRAFT`, else 409 |
| 6 | `:93-96` | total recomputed from lines |
| 7 | `:98-111` | quote created `SUBMITTED` |
| 8 | `:113-120` | `quote.submitted` audit row, **not** in a transaction with step 7 |
| 9 | `quotes/route.ts:36` | `201` |

The vendor's `status` is not checked, so an `INACTIVE` or `ON_HOLD` vendor can be quoted. Nothing stops two quotes from the same vendor on the same RFQ (by reading).

### Run pending exports

| # | Location | What happens |
|---|---|---|
| 1 | `route.ts:77-82` | session + `report.export` (every role except `VIEWER`) |
| 2 | `exportJobService.ts:68` | `findPendingBatch(tenantId, 10)`: oldest ten `PENDING` jobs for the tenant, with their **current** report definition |
| 3 | `:71-73` | for each job: `markRunning(id)`, an unconditional update by `id` |
| 4 | `:75-82` | filters come from `pendingJob.reportDefinition.filters`, the live definition, **not** from the snapshot saved at queue time (`:41-46`) |
| 5 | `:84-87` | `buildRowsForReport()` (`dashboardRepository.ts:128-234`) |
| 6 | `:89-98` | `markSucceeded()` writes `fileName`, `rowCount`, and **overwrites `snapshot`** with `{ preview: first 10 rows, rowCount }` |
| 7 | `:100-107` | `exportJob.completed` audit row with the runner as actor |
| 8 | `:110-115` | on any error: `markFailed(id, message)`. If `markFailed` itself throws, the whole request fails and later jobs in the batch are skipped |
| 9 | `:118-122` | re-list the tenant's jobs and return the ones processed |
| 10 | `run-pending/route.ts:17` | `200` `{ processed: [...] }` |

No file is written anywhere. `fileName` is a label, and the rows exist only as the 10-row preview inside `snapshot`.

### Seed the demo

| # | Location | What happens |
|---|---|---|
| 1 | `seed-demo/route.ts:14` | `withPublicRoute()`: no session, no permission |
| 2 | `seedDemoService.ts:18-20` | look for organization `acme-industrial` |
| 3 | `:22-30` | if found: return `{ alreadySeeded: true, credentials: [...] }` with three passwords |
| 4 | `:33` | hash `ProcureFlow123!` once |
| 5 | `:35-199` | one transaction creates everything listed in `docs/architecture/domain-model.md` |
| 6 | `:201-208` | return `{ alreadySeeded: false, credentials: [...] }` |

### Log out

`auth/logout/route.ts:17-29` reads the cookie, calls `authService.logout()` (`authService.ts:86-96`), which resolves the session and deletes its row with `deleteMany` (so a second logout is harmless), then clears the cookie with `expires: new Date(0)`. A cookie that no longer resolves (already logged out, expired, or signed with an old secret) is cleared without touching the database. The response is always `200 { ok: true }`.

## Receiving, line by line

`purchaseOrderService.ts:158-293`:

1. `:176-180` load the PO with line items and every earlier receipt's line items. 404 if not in the tenant.
2. `:182-187` status must be `APPROVED` or `PARTIALLY_RECEIVED`, else **409** `"Only approved purchase orders can be received."` This is the receive-before-approve guard.
3. `:189-202` build `orderedLineItems` (id → line) and `previouslyReceivedByLineItem` (id → sum of earlier receipts).
4. `:204-221` for each incoming line: unknown id → 409; `previous + incoming > ordered` → 409. The map is not updated inside this loop, so two incoming entries for the same line are each compared with the earlier total only.
5. `:223-231` compute the resulting totals, now including every incoming entry.
6. `:233-239` `RECEIVED` if every ordered line is fully covered, else `PARTIALLY_RECEIVED`.
7. `:241` transition guard. From `PARTIALLY_RECEIVED` to `PARTIALLY_RECEIVED` it throws → **500**.
8. `:243-284` one transaction: receipt with its line items and discrepancies, PO status (and `receivedAt` only when complete), audit row.
9. `:286-292` re-read and serialize.

`quantityReceived` may be `0` (`purchaseOrderSchemas.ts:53`, `nonnegative()`), so a receipt with every line at 0 is accepted and moves an `APPROVED` PO to `PARTIALLY_RECEIVED`. That uses up the one partial receipt the transition map allows.

## Status codes this API can return

| Status | When |
|---|---|
| 200 | GET routes, login, logout, approve, receive, run-pending, seed-demo |
| 201 | `POST` vendors, rfqs, quotes, purchase-orders, reports, report exports |
| 400 | Zod failure (direct parse or through `parseJsonBody()`) |
| 401 | no cookie, or the cookie does not resolve to a live session and membership; bad login |
| 403 | role lacks the route's permission |
| 404 | tenant-scoped lookup found nothing: PO, quote, vendor, RFQ, report definition |
| 409 | quote not `SUBMITTED`/`SELECTED`; RFQ not open; receive on a non-approved PO; unknown receipt line; over-receive |
| 500 | malformed JSON on `parseJsonBody()` routes; any illegal PO transition (double approve, second partial receipt); unique-constraint violations; concurrent first-time seed; any other unexpected error |

## Concurrent requests

Every guarded write in this codebase reads state, checks it in JavaScript, and then writes in a separate step. Where the write is inside `prisma.$transaction()`, the *read* is not. Prisma's interactive transactions run at the database's default isolation level (Read Committed on PostgreSQL), and none of these writes put the checked condition into the `where` clause. The three races below follow from reading the cited lines; a test with fake repositories that yield between the read and the write would reproduce them:

| Race | Window | Expected (by reading) |
|---|---|---|
| Double approve | `findById` at `purchaseOrderService.ts:125` → `approve()` at `:134` | both requests 200; two `purchaseOrder.approved` audit rows; `approvedById` is whoever wrote last |
| Double run-pending | `findPendingBatch` at `exportJobService.ts:68` → `markRunning` at `:73` | each job `RUNNING` twice, `SUCCEEDED` twice; two `exportJob.completed` audit rows; both responses list the job |
| Same quote → two POs | not even a race: the status check at `:56` accepts `SELECTED` | two POs created in sequence |

And two more by reading, with the same shape:

- **Concurrent receipts.** Two receipts that each fit within the ordered quantity on their own can both pass step 4 above against the same earlier total, and both are written.
- **Concurrent first-time seed.** Both requests miss at `seedDemoService.ts:18-20`; the second transaction fails on `Organization.slug @unique` → 500.

Sequential repeats behave better: a second approve is rejected (but with 500, not 409), and a second run-pending finds nothing.

## Debugging scenarios

| Symptom | Likely cause | Where to look |
|---|---|---|
| Second receipt for a PO fails with 500 | `PARTIALLY_RECEIVED → PARTIALLY_RECEIVED` is not in the transition map | `purchaseOrderSchemas.ts:82`, `purchaseOrderService.ts:241` |
| Approve returns 500 | PO not in `PENDING_APPROVAL` (already approved, or seeded as `APPROVED`) | `purchaseOrderService.ts:131` |
| PO created with the wrong currency or lines | `quoteId` was sent; the quote's values replace the body's | `purchaseOrderService.ts:67-74` |
| POST /api/vendors returns 500 | duplicate `code` in the tenant, or malformed JSON | `schema.prisma:167`, `route.ts:37` |
| Export finished, file missing | there is no file; only `snapshot.preview` | `exportJobService.ts:89-98` |
| Export row count ignores the saved date range | date filters are compared as strings and never exclude rows | `dashboardRepository.ts:55-61`; see `docs/learning/flow-traces.md` |
| Export result differs from what was queued | processing uses the current report definition, not the queued snapshot | `exportJobService.ts:75` |
| Dashboard shows "12 open approvals" on an empty database | the hook fell back to hard-coded data after an error | `use-dashboard-data.ts:75-87` |
| Every PO row shows the viewer as "requester" | the list route uses `session.name`, not the PO's requester | `purchase-orders/route.ts:30` |
