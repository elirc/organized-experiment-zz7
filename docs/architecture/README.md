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
