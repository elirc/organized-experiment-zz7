# Architecture Overview

VendorOS combines procurement operations and analytics in one Next.js application. The procurement side owns vendors, RFQs, quotes, purchase orders, receipts, and discrepancies. The analytics side owns saved report definitions and async export jobs over the same tenant-scoped operational data.

Top-level folders and how they relate:

- `prisma/schema.prisma` defines the relational model: organizations, memberships, vendor/sourcing/purchasing entities, reports, export jobs, and audit logs.
- `src/app/api/**/route.ts` is the HTTP boundary. Examples: `src/app/api/vendors/route.ts`, `src/app/api/purchase-orders/route.ts`, and `src/app/api/reports/[reportId]/exports/route.ts`.
- `src/lib/auth/**` holds auth/session primitives and page guards. The two load-bearing files are `src/lib/auth/session.ts` and `src/lib/auth/page-session.ts`.
- `src/lib/http/**` centralizes route wrapping and error serialization. `src/lib/http/route.ts` is the request entrypoint for auth-protected APIs.
- `src/lib/validation/**` is the Zod boundary. Route files parse request bodies with schemas like `loginRequestSchema`, `vendorCreateSchema`, `purchaseOrderReceiveSchema`, and `reportDefinitionSchema`.
- `src/repositories/**` owns database access. For example, `src/repositories/purchaseOrderRepository.ts` issues tenant-scoped PO/receipt queries and `src/repositories/dashboardRepository.ts` builds reporting read models.
- `src/services/**` owns business logic and workflow rules. `src/services/purchaseOrderService.ts` handles creation, approval, and receiving; `src/services/exportJobService.ts` owns queuing and processing report exports.
- `src/components/**` and `src/hooks/**` form the UI layer. `src/components/layout/app-shell.tsx` provides app chrome, while hooks like `src/hooks/use-vendors-data.ts` and `src/hooks/use-reports-data.ts` call the REST APIs.
- `docs/architecture/**` and `docs/learning/**` explain the request flow, domain model, and how to read the codebase as an engineer.

The architectural center of gravity is the service layer. Routes stay thin, repositories stay tenant-scoped, and React components stay mostly presentational. That split is what makes the same codebase useful both as a realistic CRUD product and as a learning artifact.

**Correction on "routes stay thin":** the mutation routes are thin. Several `GET` routes are not: they invent presentation values that are not stored anywhere. `GET /api/rfqs` labels the selected quote's warranty "12 months" and every other quote "9 months", and its lead time "Preferred" or "Standard", purely from quote status (`src/app/api/rfqs/route.ts:26-29`); due dates are `createdAt + 7 days` (`:32`). `GET /api/purchase-orders` reports the ETA as `createdAt + 7 days` (`purchase-orders/route.ts:25-27`) and the **requester as the name of whoever is viewing the list** (`:30`), not the PO's `requestedBy`. `GET /api/vendors` derives a letter "rating" from status (`vendors/route.ts:25-30`). `GET /api/dashboard` builds its workload bars from arithmetic on counts, such as `done: max(openRfqs - 1, 0)` (`dashboard/route.ts:56-72`), and its "Reported spend" tile shows a count of orders, not money (`:53`). Treat those fields as placeholders.

**Correction on "hooks ... call the REST APIs":** they do, but every data hook catches any failure, including 401, 403, and 500, and returns hard-coded sample data instead (`use-dashboard-data.ts:84-86`, `use-purchase-orders-data.ts:73-75`, `use-reports-data.ts:94-96`, `use-sourcing-data.ts:76-78`, `use-vendors-data.ts:70-72`). The UI cannot tell a permission error from real data.

---

## Layer map with line anchors

| Layer | Files | Owns | Key lines |
|---|---|---|---|
| Pages | `src/app/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/*/page.tsx`, `src/app/login/page.tsx` | page guard + one feature component each | `requirePageSession()` at `page.tsx:11` and `(app)/layout.tsx:17` |
| Components | `src/components/**` | presentation, local UI state | login flow `auth/login-page.tsx:35-90` |
| Hooks | `src/hooks/use-*-data.ts` | React Query + fetch + fallback data | five hooks, one endpoint each |
| Route handlers | `src/app/api/**/route.ts` (15 files, 19 handlers) | wrapper, permission, body parse, one service call, response shaping | table in `docs/architecture/auth-and-permissions.md` |
| HTTP helpers | `src/lib/http/route.ts`, `errors.ts` | `withRouteAuth`, `withPublicRoute`, `parseJsonBody`, error → status | `route.ts:50-89` |
| Auth | `src/lib/auth/*.ts`, `src/services/authService.ts` | cookie, JWT, hashed session row, membership reload | `authService.ts:99-145` |
| Validation | `src/lib/validation/*.ts` | Zod schemas, permission matrix, transition maps | `authSchemas.ts:49-121`, `purchaseOrderSchemas.ts:75-97` |
| Services | `src/services/*.ts` | workflow rules, transactions, audit writes | `purchaseOrderService.ts:27-294` |
| Repositories | `src/repositories/*.ts` | Prisma queries with `tenantId` | `getDb(client)` pattern, e.g. `purchaseOrderRepository.ts:16-18` |
| Persistence | `prisma/schema.prisma`, `src/lib/prisma/client.ts` | PostgreSQL model, singleton client | 17 models, 11 enums |

Repositories that take an optional `client` (`RepositoryClient`, `repository-types.ts:3`) can join a service's transaction: `auditLogRepository`, `exportJobRepository`, `purchaseOrderRepository`, `sourcingRepository`. `vendorRepository`, `reportRepository`, `authRepository`, and `dashboardRepository` always use the global client. This matters in `createPurchaseOrder()`, where the vendor and quote reads cannot be part of the transaction.

## Verified absences

Each of these was checked by searching the tree:

- **No migrations.** `prisma/` contains only `schema.prisma`. There is no `prisma/migrations/` folder and no seed script, so a fresh database needs `npx prisma db push` (or `prisma migrate dev` to create a first migration) before `POST /api/seed-demo` can work.
- **No `.env.example`.** The app reads `DATABASE_URL` (through `schema.prisma:7`) and `SESSION_SECRET` (`src/lib/env.ts:15-16`, with an insecure fallback). `env.databaseUrl` and `env.nodeEnv` are defined (`env.ts:12-17`) but nothing reads them.
- **No middleware.** There is no `middleware.ts`/`proxy.ts`; page protection is the `requirePageSession()` call in the two layouts listed above.
- **No background worker.** Exports run only when someone calls `POST /api/export-jobs/run-pending`. No UI calls it.
- **No close, cancel, or update routes** for POs, RFQs, vendors, or reports. `CLOSED`, `CANCELLED`, `DRAFT`, and `EXPIRED` statuses are never written by application code.
- **No UI for any mutation except login, logout, and seeding.** Vendors, sourcing, purchase-order, and reports pages are read-only. The reports page's "Queue export" button only calls `console.info` (`reports-page.tsx:168-174`).
- **No audit-log reader.** `AuditLog` rows are written by six services and read by nothing. The `audit.read` permission is never checked.
- **No integration tests.** The four Vitest files test pure validation helpers only. See `docs/learning/testing-rationale.md`.

## Known defects at a glance

Details and evidence are in the linked pages.

| # | Defect | Verified | Page |
|---|---|---|---|
| 1 | A second partial receipt fails with 500 | by reading | `domain-model.md` |
| 2 | Requester can approve their own PO | by reading | `auth-and-permissions.md` |
| 3 | Overlapping approvals both succeed; illegal transitions are 500 not 409 | by reading | `request-lifecycle.md` |
| 4 | Overlapping `run-pending` calls process the same job twice | by reading | `request-lifecycle.md` |
| 5 | `POST /api/seed-demo` is anonymous and returns the admin password | by reading | `auth-and-permissions.md` |
| 6 | One quote can become many POs | by reading | `domain-model.md` |
| 7 | Duplicate line entries in one receipt bypass the over-receive check; discrepancy line items are unchecked | by reading | `auth-and-permissions.md` |
| 8 | Saved report date filters never exclude rows | by reading | `docs/learning/flow-traces.md` |
| 9 | Malformed JSON on `parseJsonBody()` routes is 500 | by reading | `auth-and-permissions.md` |
| 10 | Data hooks show sample data on any API error | by reading | this page |
