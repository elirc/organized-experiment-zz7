/**
 * What this file does:
 * Records goods receipt for a purchase order and applies discrepancy-aware status changes.
 * What calls it:
 * Future receiving actions in the purchase-order UI.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/purchaseOrderSchemas.ts`, and `src/services/purchaseOrderService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Accepting arbitrary receipt line-item IDs without confirming they belong to the target PO.
 */
import { jsonOk, withRouteAuth, type RouteContext } from "@/lib/http/route";
import { purchaseOrderReceiveSchema } from "@/lib/validation";
import { purchaseOrderService } from "@/services/purchaseOrderService";

export const POST = withRouteAuth(
  async (
    request,
    context: RouteContext<{ purchaseOrderId: string }>,
    session,
  ) => {
    const { purchaseOrderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = purchaseOrderReceiveSchema.parse({
      ...body,
      purchaseOrderId,
      receivedById: session.userId,
      status:
        Array.isArray(body?.discrepancies) && body.discrepancies.length > 0
          ? "DISCREPANCY_RECORDED"
          : "RECORDED",
    });
    const purchaseOrder = await purchaseOrderService.receivePurchaseOrder(session, purchaseOrderId, {
      discrepancies: input.discrepancies,
      lineItems: input.lineItems,
      notes: input.notes,
      receivedAt: input.receivedAt,
    });

    return jsonOk(purchaseOrder);
  },
  { permission: "purchaseOrder.receive" },
);

// ⚠️ SENIOR NOTE: Receiving is one of the highest-risk mutation paths because it affects inventory truth, discrepancy
// counts, and PO completion state all at once.
