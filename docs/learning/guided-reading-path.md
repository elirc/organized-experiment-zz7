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

## Step 7 — src/repositories/purchaseOrderRepository.ts
**Why read this:** It shows how transactional workflow code still delegates database writes to a repository.
**What to look for:** `findById()`, `create()`, `approve()`, `createReceipt()`, and `updateStatus()`.
**What to trace:** Called by `src/services/purchaseOrderService.ts`; it calls Prisma directly.
**What a junior would likely miss:** Receipt creation preserves ordered line-item IDs so downstream discrepancy logic stays trustworthy.

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
