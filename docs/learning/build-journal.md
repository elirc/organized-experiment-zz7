# Build Journal

## Stage 1 — Project framing
Built: Combined a procurement operations product with an analytics/reporting layer.
Decision: Use multi-tenancy because this domain realistically serves multiple organizations and benefits from explicit tenant-aware auth.
Why: It makes tenant scoping a first-class architectural concern instead of a future retrofit.

## Stage 2 — Stack choice
Built: Next.js App Router, TypeScript, PostgreSQL, Prisma, Tailwind, Zod, React Query, REST routes.
Decision: Chose Prisma over Drizzle.
Why: The domain has many relations and a few transaction-heavy workflow transitions, and Prisma made the model and transactional service code easier to read quickly.

## Stage 3 — Domain and schema
Built: `prisma/schema.prisma` with organizations, memberships, sessions, vendors, RFQs, quotes, purchase orders, receipts, discrepancies, report definitions, export jobs, and audit logs.
Decision: Keep report definitions and export jobs as a separate module over procurement data rather than stuffing reporting logic into PO services.
Why: Saved-query lifecycle and async export state are different concerns from procurement mutations.

## Stage 4 — Auth and permissions
Built: `src/lib/auth/session.ts`, `src/services/authService.ts`, `src/lib/http/route.ts`, `src/lib/auth/page-session.ts`, and `src/lib/validation/authSchemas.ts`.
Decision: Use signed cookie sessions backed by revocable DB session rows.
Why: It teaches a stronger pattern than client-only tokens while staying simpler than a full external auth provider.

## Stage 5 — Repository and service layers
Built: Tenant-scoped repositories in `src/repositories/**` and workflow services in `src/services/**`.
Decision: Keep transaction boundaries in services, not repositories.
Why: The service layer is where cross-aggregate business rules live, so it should decide when multiple repository operations must succeed together.

## Stage 6 — UI and request flow
Built: `src/components/**`, `src/hooks/**`, and route handlers under `src/app/api/**`.
Decision: Let hooks consume page-shaped read models from routes instead of raw entities.
Why: It keeps React components cleaner and preserves the backend as the place where reporting/operational meaning is assembled.

## Stage 7 — Async exports and tests
Built: Export queue + runner in `src/services/exportJobService.ts` and focused Vitest coverage under `src/test/**`.
Decision: Model export jobs as first-class records with `PENDING/RUNNING/SUCCEEDED/FAILED`.
Why: Background work needs observable operational state, not just a button that "downloads something."

## Stage 8 — Documentation and learning artifacts
Built: `docs/architecture/**`, `docs/learning/**`, and `docs/learning/agent-usage.md`.
Decision: Anchor docs to actual files and functions instead of generic explanations.
Why: The goal is to teach code reading, not to ship abstract architecture prose.

## PR Slices

### Slice 1 — Schema, auth primitives, and route boundary
Purpose: Establish the data model, session model, and reusable request wrapper before feature work.
Novel logic files: `prisma/schema.prisma`, `src/lib/auth/session.ts`, `src/services/authService.ts`, `src/lib/http/route.ts`, `src/lib/validation/authSchemas.ts`.
Reviewer focus:
- `prisma/schema.prisma`: verify tenant-owned tables really carry `tenantId` and workflow enums cover the intended states.
- `src/services/authService.ts`: verify `resolveSessionFromSignedToken()` checks signed token claims against the DB session row, not just the JWT.
- `src/lib/http/route.ts`: verify auth and permission checks run before handlers execute.
What a junior reviewer might miss: A session cookie can still be insecure even if login "works" if revocation is not enforced server-side.

### Slice 2 — Procurement CRUD and sourcing workflows
Purpose: Add vendors, RFQs, and quotes with explicit service/repository boundaries.
Novel logic files: `src/repositories/vendorRepository.ts`, `src/repositories/sourcingRepository.ts`, `src/services/vendorService.ts`, `src/services/sourcingService.ts`, `src/app/api/vendors/route.ts`, `src/app/api/rfqs/**`.
Reviewer focus:
- `src/repositories/sourcingRepository.ts`: verify quote selection updates sibling quotes and the parent RFQ together.
- `src/services/sourcingService.ts`: verify quote totals are recomputed on the server.
What a junior reviewer might miss: Client-provided totals are a trust boundary issue, not just a convenience field.

### Slice 3 — Purchase-order workflow and receiving
Purpose: Add the strongest business-process logic in the app.
Novel logic files: `src/repositories/purchaseOrderRepository.ts`, `src/services/purchaseOrderService.ts`, `src/app/api/purchase-orders/**`, `src/lib/validation/purchaseOrderSchemas.ts`.
Reviewer focus:
- `src/services/purchaseOrderService.ts`: verify quantity checks use cumulative receipt history before writing.
- `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts`: verify approver identity comes from the session, not the body.
- `src/app/api/purchase-orders/[purchaseOrderId]/receive/route.ts`: verify route-param PO ownership beats body IDs.
What a junior reviewer might miss: Over-receiving often happens through several small valid requests, not one obviously bad request.

### Slice 4 — Reporting and async exports
Purpose: Add saved reports, export jobs, and reporting read models over the procurement data.
Novel logic files: `src/repositories/reportRepository.ts`, `src/repositories/exportJobRepository.ts`, `src/repositories/dashboardRepository.ts`, `src/services/reportService.ts`, `src/services/exportJobService.ts`, `src/app/api/reports/**`.
Reviewer focus:
- `src/services/exportJobService.ts`: verify queueing and processing are separate methods and stay tenant-scoped.
- `src/repositories/dashboardRepository.ts`: verify analytics reads still apply `tenantId`.
What a junior reviewer might miss: Reporting tables and export jobs are just as sensitive as procurement transactions because they can expose cross-tenant slices.

### Slice 5 — UI shell, tests, and docs
Purpose: Make the product explorable and the codebase teachable.
Novel logic files: `src/components/auth/login-page.tsx`, `src/components/layout/app-shell.tsx`, `src/hooks/**`, `src/test/**`, `docs/**`.
Reviewer focus:
- `src/components/auth/login-page.tsx`: verify it uses the real auth route and seed route instead of fake local auth.
- `src/test/purchase-order-transition.test.ts`: verify the test targets a real risky workflow rule.
- `docs/architecture/request-lifecycle.md`: verify the traced files/functions match the code as shipped.
What a junior reviewer might miss: Docs can become wrong architecture if they are not treated as part of the review surface.
