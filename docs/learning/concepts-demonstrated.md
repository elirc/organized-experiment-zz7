# Concepts Demonstrated

## Service Layer
Where to look: `src/services/purchaseOrderService.ts` — `receivePurchaseOrder()` owns the workflow rules and transaction orchestration.
Also see: `src/services/exportJobService.ts` for a non-CRUD async workflow.
Risk if wrong: Business rules drift into routes or React components and become unreviewable.

## Repository Pattern
Where to look: `src/repositories/vendorRepository.ts` — `listForTenant()` and `findById()` isolate tenant-scoped data access.
Also see: `src/repositories/purchaseOrderRepository.ts` for multi-query workflow persistence.
Risk if wrong: Repositories stop being the trusted tenant boundary and cross-tenant leaks become much easier.

## Zod Validation Boundary
Where to look: `src/app/api/vendors/route.ts` — `parseJsonBody(request, vendorCreateSchema)` validates the request before it reaches the service.
Also see: `src/app/api/reports/route.ts` with `reportDefinitionSchema`.
Risk if wrong: Bad input shapes reach business logic and create ambiguous failures deeper in the stack.

## Auth / Session Flow
Where to look: `src/services/authService.ts` — `authService.login()` and `resolveSessionFromSignedToken()` create and resolve revocable sessions.
Also see: `src/lib/auth/session.ts` for signing and hashing details.
Risk if wrong: Session forgery, stale sessions, or broken logout behavior.

## Role-Based Access Control
Where to look: `src/lib/validation/authSchemas.ts` — `rolePermissionMatrix` and `requirePermission()`.
Also see: `src/lib/auth/permissions.ts` for the adapter used by routes.
Risk if wrong: UI and API permissions drift, or lower-privilege roles gain mutation access.

## Status / State Transitions
Where to look: `src/lib/validation/purchaseOrderSchemas.ts` — `assertPurchaseOrderStatusTransition()` encodes legal PO transitions.
Also see: `src/services/purchaseOrderService.ts` where the transition guard is enforced before approval and receiving writes.
Risk if wrong: Purchase orders skip approval or move into impossible states that downstream teams must clean up manually.

## Audit Logging
Where to look: `src/repositories/auditLogRepository.ts` — `create()` persists workflow events.
Also see: `src/services/vendorService.ts`, `src/services/purchaseOrderService.ts`, and `src/services/exportJobService.ts` for where audit writes are triggered.
Risk if wrong: Security reviews and operational debugging lose the ability to explain who changed what.

## Background Job Design
Where to look: `src/services/exportJobService.ts` — `createExportJob()` queues work and `runPendingJobs()` processes it later.
Also see: `src/repositories/exportJobRepository.ts` for job-state persistence.
Risk if wrong: Exports run twice, hang without visibility, or block normal request/response UX.

## Multi-Tenancy
Where to look: `src/repositories/purchaseOrderRepository.ts` — every tenant-owned query includes `tenantId`.
Also see: `src/repositories/dashboardRepository.ts` for tenant-scoped analytics reads and `src/lib/validation/authSchemas.ts` for `assertTenantScope()`.
Risk if wrong: The most severe failure mode in this codebase is returning one organization’s procurement or report data to another.
