# Guided Reading Path

## Step 1 — src/lib/http/route.ts
**Why read this:** It is the API boundary every protected route relies on.
**What to look for:** `withRouteAuth()`, `parseJsonBody()`, and `handleRouteError()`.
**What to trace:** Called by `src/app/api/vendors/route.ts`, `src/app/api/purchase-orders/route.ts`, and `src/app/api/reports/route.ts`; it calls `resolveSessionFromRequest()` in `src/services/authService.ts`.
**What a junior would likely miss:** The route wrapper is part of the security model, not just a convenience helper.

## Step 2 — src/services/authService.ts
**Why read this:** It shows how credential login, signed cookies, revocable DB sessions, and membership loading fit together.
**What to look for:** `authService.login()`, `resolveSessionFromSignedToken()`, and `resolveSessionFromRequest()`.
**What to trace:** Called by `src/app/api/auth/login/route.ts`, `src/lib/http/route.ts`, and `src/lib/auth/page-session.ts`; it calls `src/repositories/authRepository.ts` and `src/lib/auth/session.ts`.
**What a junior would likely miss:** The signed token is not the source of truth by itself; the hashed session row is still checked.

## Step 3 — src/lib/validation/authSchemas.ts
**Why read this:** It contains the RBAC vocabulary and the permission matrix used by tests and route guards.
**What to look for:** `permissionActionSchema`, `rolePermissionMatrix`, `requirePermission()`, and `assertTenantScope()`.
**What to trace:** Called by `src/lib/auth/permissions.ts` and tests in `src/test/auth-permissions.test.ts`.
**What a junior would likely miss:** Permission strings are part of the API contract and should not be duplicated ad hoc.

## Step 4 — src/repositories/vendorRepository.ts
**Why read this:** It is a small, clear example of tenant-scoped repository design.
**What to look for:** The `tenantId` filter in `listForTenant()` and `findById()`.
**What to trace:** Called by `src/services/vendorService.ts`, which is called by `src/app/api/vendors/route.ts`.
**What a junior would likely miss:** Repository scoping is the last reliable place to stop a cross-tenant leak.

## Step 5 — src/services/sourcingService.ts
**Why read this:** It shows server-side quote total recomputation and RFQ state protection.
**What to look for:** `createRfq()` and `createQuote()`.
**What to trace:** Called by `src/app/api/rfqs/route.ts` and `src/app/api/rfqs/[rfqId]/quotes/route.ts`; it calls `src/repositories/sourcingRepository.ts` and `src/repositories/vendorRepository.ts`.
**What a junior would likely miss:** `totalAmount` from the client is ignored on purpose because server recomputation is safer.

## Step 6 — src/services/purchaseOrderService.ts
**Why read this:** This is the strongest workflow/state-machine file in the app.
**What to look for:** `createPurchaseOrder()`, `approvePurchaseOrder()`, and `receivePurchaseOrder()`.
**What to trace:** Called by `src/app/api/purchase-orders/route.ts` and child routes under `src/app/api/purchase-orders/[purchaseOrderId]/**`; it calls `src/repositories/purchaseOrderRepository.ts`, `src/repositories/sourcingRepository.ts`, and `src/repositories/auditLogRepository.ts`.
**What a junior would likely miss:** Receiving validates cumulative quantity across prior receipts, not just the current payload.
**Correction:** it validates against prior receipts only. Two entries for the same line inside one payload are each compared with the prior total and are not added to each other until after the check (`purchaseOrderService.ts:204-231`; run). Also, the transition guard at `:241` rejects a second partial receipt, so in practice there is at most one prior receipt to add up. See exercise 4 below.

## Step 7 — src/repositories/purchaseOrderRepository.ts
**Why read this:** It shows how transactional workflow code still delegates database writes to a repository.
**What to look for:** `findById()`, `create()`, `approve()`, `createReceipt()`, and `updateStatus()`.
**What to trace:** Called by `src/services/purchaseOrderService.ts`; it calls Prisma directly.
**What a junior would likely miss:** Receipt creation preserves ordered line-item IDs so downstream discrepancy logic stays trustworthy.
**Correction:** receipt *line items* are checked against the PO before `createReceipt()` is called, but *discrepancies* are not. `createReceipt()` writes whatever `purchaseOrderLineItemId` each discrepancy carries (`purchaseOrderRepository.ts:163-169`), and the service never checks them. A discrepancy can point at another PO's line, or another tenant's, and the `RECEIVING_DISCREPANCY` report would then print that other PO's number (`dashboardRepository.ts:188-208`). Note also that `approve()` and `updateStatus()` use `updateMany` with `{ id, tenantId }` and no status condition (`:99-128`), which is why the approval race exists.

## Step 8 — src/services/exportJobService.ts
**Why read this:** It is the async workflow example in the codebase.
**What to look for:** `createExportJob()` and `runPendingJobs()`.
**What to trace:** Called by `src/app/api/reports/[reportId]/exports/route.ts` and `src/app/api/export-jobs/run-pending/route.ts`; it calls `src/repositories/exportJobRepository.ts`, `src/repositories/reportRepository.ts`, and `src/repositories/dashboardRepository.ts`.
**What a junior would likely miss:** Queueing and processing are intentionally separate operations.

## Step 9 — src/repositories/dashboardRepository.ts
**Why read this:** It demonstrates read-model thinking instead of CRUD thinking.
**What to look for:** `getSummary()` and `buildRowsForReport()`.
**What to trace:** Called by `src/services/dashboardService.ts` and `src/services/exportJobService.ts`.
**What a junior would likely miss:** Reporting logic belongs in a dedicated read layer, not in React components.

## Step 10 — src/app/api/reports/route.ts
**Why read this:** It shows one route returning a page-shaped read model while still using multiple services under the hood.
**What to look for:** The combined `GET` that returns both report definitions and export jobs, and the `POST` path that validates `reportDefinitionSchema`.
**What to trace:** Calls `src/services/reportService.ts` and `src/services/exportJobService.ts`.
**What a junior would likely miss:** Combined screen data does not mean business logic should also be combined.

## Step 11 — src/components/auth/login-page.tsx
**Why read this:** It is the clearest UI-to-API teaching example in the app.
**What to look for:** The `handleSeedDemo()` and `handleSubmit()` request flow.
**What to trace:** Calls `/api/seed-demo` and `/api/auth/login`, which land in `src/app/api/seed-demo/route.ts` and `src/app/api/auth/login/route.ts`.
**What a junior would likely miss:** The point is to teach the real auth path, not to fake session state in the component.

## Step 12 — src/test/purchase-order-transition.test.ts
**Why read this:** It shows how lightweight tests can still target high-risk workflow behavior.
**What to look for:** The invalid transition assertion around `assertPurchaseOrderStatusTransition()`.
**What to trace:** Calls validation logic in `src/lib/validation/purchaseOrderSchemas.ts`.
**What a junior would likely miss:** Transition rules are cheap to test and expensive to debug in production if left untested.
**Also notice:** the test checks one forbidden edge and one allowed edge. It does not check that the states the service actually produces are all allowed. The missing `PARTIALLY_RECEIVED → PARTIALLY_RECEIVED` edge (exercise 4) is exactly the kind of bug a table-driven test over the service's real outputs would catch.

---

## Exercises

Each exercise names the files to open and has an answer you can check against. Do them in order; later ones assume earlier ones. Line numbers refer to the files at the commit these docs ship with.

### Exercise 1 — Who can run exports?

Open `src/app/api/export-jobs/run-pending/route.ts` and `src/lib/validation/authSchemas.ts:49-96`. List every membership role that can call `POST /api/export-jobs/run-pending`.

**Answer:** the route requires `report.export` (`run-pending/route.ts:19`). `ORG_ADMIN`, `PROCUREMENT_MANAGER`, `BUYER`, `AP_CLERK`, and `ANALYST` have it; `VIEWER` does not. Any `SUPER_ADMIN` passes too (`authSchemas.ts:111-113`). The runner processes everyone's pending jobs in the tenant, not just their own (`exportJobService.ts:68`).

### Exercise 2 — Who can call the seed route?

Open `src/app/api/seed-demo/route.ts` and `src/lib/http/route.ts:91-101`.

**Answer:** anyone, with no cookie. `withPublicRoute()` only wraps errors. On a seeded database the response includes the admin password (`seedDemoService.ts:22-30`).

### Exercise 3 — Can Marco approve his own PO?

Marco is `PROCUREMENT_MANAGER`. Open `purchaseOrderService.ts:33-156`. Marco creates a PO with `POST /api/purchase-orders`, then calls approve on it.

**Answer:** yes. `createPurchaseOrder()` sets `requestedById: session.userId` (`:98`), and `approvePurchaseOrder()` never reads `requestedById`. Both permissions are in his role. The audit log will show the same `actorUserId` on `purchaseOrder.created` and `purchaseOrder.approved`.

### Exercise 4 — Receive a PO in three deliveries

PO with one line of 120 units, status `APPROVED`. Deliveries arrive as 40, 40, 40. Walk `receivePurchaseOrder()` (`purchaseOrderService.ts:158-293`) for each, and look up each `assertPurchaseOrderStatusTransition()` call in `purchaseOrderSchemas.ts:75-86`.

**Answer:**
- Delivery 1: prior 0, cumulative 40 ≤ 120. Not complete, so `nextStatus = PARTIALLY_RECEIVED`. Guard `APPROVED → PARTIALLY_RECEIVED` is allowed. Status becomes `PARTIALLY_RECEIVED`.
- Delivery 2: status check at `:182-187` passes. Prior 40, cumulative 80 ≤ 120. Still partial, so `nextStatus = PARTIALLY_RECEIVED`. Guard `PARTIALLY_RECEIVED → PARTIALLY_RECEIVED` is **not** in the map. It throws a plain `Error`, and the client gets 500. Nothing is written.
- Delivery 3 never happens. The only way forward is to post the remaining 80 in one receipt, which makes `nextStatus = RECEIVED`.

This follows from reading `purchaseOrderService.ts:182-241` and the map at `purchaseOrderSchemas.ts:82`. The fix is one line in either file.

### Exercise 5 — Over-receive in one request

Same PO, fresh, `APPROVED`. Post one receipt with `lineItems: [{ L1, 120 }, { L1, 120 }]`.

**Answer:** accepted. The check loop at `:204-221` compares each entry with `previouslyReceivedByLineItem`, which is 0 for both. The totals loop at `:225-231` then adds both, giving 240. Every line is "fully received", so the PO becomes `RECEIVED` with 240 of 120 recorded.

### Exercise 6 — Why is a double approve a 500?

Open `purchaseOrderSchemas.ts:92-94` and `src/lib/http/route.ts:50-69`.

**Answer:** the guard throws `new Error(...)`. `handleRouteError()` only maps `ZodError` and `AppError` subclasses; everything else becomes 500. Using `ConflictError` from `src/lib/http/errors.ts:40-44` would give 409. That change would also turn exercise 4's failure into a 409, which is a better message for the same bug, not a fix.

### Exercise 7 — Find the race

Open `exportJobService.ts:67-123` and `exportJobRepository.ts:57-79`. Two tabs call run-pending at the same moment. What happens to a single pending job?

**Answer:** both calls read it as `PENDING` (`:68`), both call `markRunning()` (an update by `id` with no status condition), both build rows, both mark it `SUCCEEDED`, and both write an `exportJob.completed` audit row. The fix is to make the claim conditional: `updateMany({ where: { id, status: "PENDING" } })` and skip the job when `count` is 0.

### Exercise 8 — The date filter that does nothing

Open `reportSchemas.ts:38-45`, `reportService.ts:40-44`, `exportJobService.ts:75-82`, and `dashboardRepository.ts:55-61`. Save a report with `dateFrom: "2030-01-01"` and export it.

**Answer:** every row is returned. The `Date` is stored in a `Json` column as a string; `Date < string` compares a number with `NaN`, which is always `false`. See `docs/learning/flow-traces.md`, last flow.

### Exercise 9 — What does an analyst see on /purchase-orders?

Erin is `ANALYST`. Open `src/app/api/purchase-orders/route.ts:36` and `src/hooks/use-purchase-orders-data.ts:64-76`.

**Answer:** the API returns 403, because `ANALYST` lacks `purchaseOrder.read`. The hook catches the error and returns three hard-coded POs (`PO-1048`, `PO-1041`, `PO-1035`). Erin sees invented data with no error. Meanwhile her dashboard shows real PO numbers from her tenant, because `/api/dashboard` has no permission check (`dashboard/route.ts:14`).

### Exercise 10 — Unused code

Find every exported function or schema in `src/lib/validation/**` that no file in `src/` (outside `src/test/`) uses.

**Answer:** `sessionClaimsSchema`, `assertTenantScope` (test only), `rfqUpdateSchema`, `assertRfqStatusTransition`, `vendorUpdateSchema`, `vendorListQuerySchema`, `VendorCreateInput`. Re-exported enums such as `rfqStatusSchema` are used only inside their own file. Outside validation: `hasPermission()` (`permissions.ts:38-48`), `reportService.getReport()` and `reportService.listExportJobs()` (`reportService.ts:58-74`), `reportRepository.listExportJobsForTenant()`, and `authRepository.countOrganizations()`. The `reportService` header says it is called by the export-jobs route (`reportService.ts:5`); that route actually calls `exportJobService.listExportJobs()` (`export-jobs/route.ts:16`).

## Reading rungs

If you want a shorter path, read in these rungs and stop when you can answer the rung's question.

| Rung | Files | Question you should be able to answer |
|---|---|---|
| 1 | `route.ts`, `errors.ts` | Which thrown values become 400, 401, 403, 404, 409, 500? |
| 2 | `authService.ts`, `session.ts`, `authRepository.ts` | What five things must be true for a cookie to resolve to a session? |
| 3 | `authSchemas.ts`, every `route.ts` under `src/app/api` | Which routes have no permission, and which are public? |
| 4 | `purchaseOrderService.ts`, `purchaseOrderSchemas.ts`, `purchaseOrderRepository.ts` | Exercises 3 to 6 |
| 5 | `exportJobService.ts`, `exportJobRepository.ts`, `dashboardRepository.ts` | Exercises 7 and 8 |
| 6 | `src/hooks/*.ts`, `src/components/**` | Exercise 9; which buttons call an API? |
