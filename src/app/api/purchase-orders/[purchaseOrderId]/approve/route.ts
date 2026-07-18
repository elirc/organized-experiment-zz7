/**
 * What this file does:
 * Approves a pending purchase order.
 * What calls it:
 * Future approval actions in the purchase-order UI.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/purchaseOrderSchemas.ts`, and `src/services/purchaseOrderService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Trusting an `approverUserId` from the client instead of using the authenticated session.
 */
import { jsonOk, withRouteAuth, type RouteContext } from "@/lib/http/route";
import { purchaseOrderApproveSchema } from "@/lib/validation";
import { purchaseOrderService } from "@/services/purchaseOrderService";

export const POST = withRouteAuth(
  async (
    request,
    context: RouteContext<{ purchaseOrderId: string }>,
    session,
  ) => {
    const { purchaseOrderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    purchaseOrderApproveSchema.parse({
      ...body,
      approvedAt: new Date(),
      approverUserId: session.userId,
      purchaseOrderId,
    });

    const purchaseOrder = await purchaseOrderService.approvePurchaseOrder(
      session,
      purchaseOrderId,
    );

    return jsonOk(purchaseOrder);
  },
  { permission: "purchaseOrder.approve" },
);

// ⚠️ SENIOR NOTE: Approval routes should derive the approver from the session. Accepting it from the client lets one
// user impersonate another in the audit trail.
