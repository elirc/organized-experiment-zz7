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
**Correction:** the guard runs before the writes but outside their transaction (`purchaseOrderService.ts:131` vs `:133`, `:241` vs `:243`), so two overlapping approvals both pass it. It throws a plain `Error`, which the HTTP layer turns into a 500 rather than a 409. And the map has no `PARTIALLY_RECEIVED → PARTIALLY_RECEIVED` edge, so a second partial receipt is rejected.
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
**Correction:** `assertTenantScope()` is not used by any request path; only `src/test/tenant-isolation.test.ts` calls it. Isolation comes entirely from the `tenantId` filters in repository queries.

---

## How well each concept holds up

Each concept above was checked against the code. "Holds" means the claim is true; "gap" names where it stops being true.

| Concept | Holds | Gap | Evidence |
|---|---|---|---|
| Service layer | every mutation route makes exactly one service call | several `GET` routes build UI values the services do not provide (fake warranty, ETA, rating, requester = viewer) | `rfqs/route.ts:26-29`, `purchase-orders/route.ts:25-30` |
| Repository pattern | every repository query on a tenant-owned table includes `tenantId` | export-job `mark*` writes update by `id` only; `dashboardRepository` also serves exports, mixing read models with export logic | `exportJobRepository.ts:71-107` |
| Zod boundary | every handler that reads a body (login plus eight authenticated mutations) validates it before the service call | malformed JSON → 500 on `parseJsonBody()` routes; approve route validates an object and throws the result away; `notes` fields are validated then dropped | `route.ts:37`, `approve/route.ts:23-28` |
| Auth / session | JWT + hashed DB row + membership reload; revocation works | fallback secret; no rate limiting; cookie not `secure` outside production | `env.ts:15-16`, `login/route.ts:30` |
| RBAC | one matrix, enforced on 14 handlers | dashboard has no permission; `audit.read` never checked; `AppPermission` duplicates the vocabulary; no separation of duties | `dashboard/route.ts:14`, `permissions.ts:19-31` |
| State transitions | the PO map is consulted on approve and receive | guard throws plain `Error` → 500; missing self-loop breaks a second partial receipt; RFQ map never used; `CLOSED`/`CANCELLED` unreachable | `purchaseOrderSchemas.ts:82`, `:93`; `rfqSchemas.ts:52` |
| Audit logging | every mutation writes an audit row | same transaction only for the PO workflow; elsewhere the audit write is a second call; nothing reads the log | `vendorService.ts:32-44` |
| Background jobs | jobs are rows with `PENDING/RUNNING/SUCCEEDED/FAILED` | no worker, no claim, no retry, no stuck-job recovery; double processing; output is a 10-row preview, no file | `exportJobService.ts:67-123` |
| Multi-tenancy | sessions are bound to one organization; every lookup is tenant-scoped | discrepancy rows can reference another tenant's line item; no DB-level enforcement | `purchaseOrderRepository.ts:163-169` |

## Concepts the code demonstrates that were not listed

### Check-then-act races

Where to look: `src/services/purchaseOrderService.ts:124-147` (approve) and `src/services/exportJobService.ts:67-108` (by reading-pending).
What it shows: a status read, a JavaScript check, and an unconditional write, with a gap in between. Wrapping only the write in `prisma.$transaction()` does not close the gap, because the read is outside it and PostgreSQL's default Read Committed level does not lock rows that were only read.
Risk if wrong: duplicate approvals and duplicate exports.
The usual fix: put the condition in the write (`updateMany({ where: { id, status: "PENDING_APPROVAL" } })` and check `count`), or `SELECT ... FOR UPDATE` inside the transaction.

### Separation of duties

Where to look: `src/services/purchaseOrderService.ts:124-156`.
What it shows by its absence: role-based permission says *which roles* may approve. It does not say "not your own request". That second rule has to be written against the record (`requestedById !== session.userId`), which RBAC alone cannot express.
Risk if wrong: one person can raise and approve spending.

### Server-side recomputation of client values

Where to look: `src/app/api/rfqs/[rfqId]/quotes/route.ts:27` and `src/services/sourcingService.ts:93-96`.
What it shows: the route overwrites any client `totalAmount` with `0` just to satisfy the schema, and the service recomputes the real total from the lines. The same idea appears in `createPurchaseOrder()`, which replaces the body's vendor, currency, and lines with the quote's.
Risk if wrong: tampered totals.
Caveat: the recomputation uses JavaScript floating point before `toFixed(2)`.

### Route parameters beat body IDs

Where to look: `approve/route.ts:23-27`, `receive/route.ts:23-26`, `quotes/route.ts:23-27`, `reports/[reportId]/exports/route.ts:23-26`.
What it shows: each route spreads the body first, then overwrites the IDs from the URL and the session. Because the spread comes first, a client cannot override them.
Risk if wrong: a request to one URL acting on a different record.

### Error taxonomy

Where to look: `src/lib/http/errors.ts:11-50` and `src/lib/http/route.ts:50-69`.
What it shows: typed errors carry their own status and code, and one function maps them. The flip side is also instructive: anything thrown that is not one of these types becomes a 500, which is how the plain `Error` in the transition guard and the malformed-JSON `SyntaxError` escape.

### Fallback data in the client

Where to look: `src/hooks/use-vendors-data.ts:60-73` and the four sibling hooks.
What it shows: a design choice to keep the UI demoable without a backend. Each hook's own senior note warns about it.
Risk if wrong: a 403 or 500 is shown as plausible data, which hides permission and outage problems.
