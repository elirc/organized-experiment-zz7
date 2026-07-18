# Testing Rationale

`src/test/auth-permissions.test.ts` — `rejects a viewer trying to approve a purchase order`
This matters because `"purchaseOrder.approve"` is a finance-control boundary. If a viewer can reach that action in production, approval history stops meaning anything. A fuller suite would also hit `src/app/api/purchase-orders/[purchaseOrderId]/approve/route.ts` end-to-end and assert the exact `403` response shape.

`src/test/auth-permissions.test.ts` — `allows a procurement manager to approve a purchase order`
This matters because over-restrictive RBAC is also a production bug. Teams will work around a broken approval path manually, which is how shadow processes appear. A fuller suite would test several roles against several route-level permissions, not just one allow case.

`src/test/validation-boundaries.test.ts` — report-definition validation rejection
This matters because saved reports can become long-lived bad state if unsupported dimensions, duplicate metrics, or inverted date filters are accepted once. A fuller suite would pair schema tests with route tests for `src/app/api/reports/route.ts`.

`src/test/purchase-order-transition.test.ts` — invalid purchase-order transition
This matters because workflow corruption usually starts with one illegal state hop that "seemed harmless" at the time. If a PO can skip approval or move backward incorrectly, downstream receiving and analytics become unreliable. A fuller suite would test `receivePurchaseOrder()` in `src/services/purchaseOrderService.ts` with several partial/full receipt sequences.

`src/test/tenant-isolation.test.ts` — cross-tenant mismatch rejection
This matters because tenant isolation is the highest-severity correctness rule in the entire codebase. A fuller suite would add repository-level tests asserting that methods like `findById()` in `src/repositories/vendorRepository.ts` and `src/repositories/purchaseOrderRepository.ts` always include `tenantId` in the query.

Overall review comment:
These tests are intentionally light, but they are load-bearing. They target the classes of bugs that tend to survive happy-path CRUD coverage: authorization drift, validation drift, invalid workflow transitions, and tenant leaks. In a production suite, the next layer to add would be route-level integration tests that prove the request wrapper, Zod boundary, service layer, and repository scoping all stay aligned.
