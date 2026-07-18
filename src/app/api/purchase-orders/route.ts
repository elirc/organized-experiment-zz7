/**
 * What this file does:
 * Lists purchase orders and creates new purchase orders.
 * What calls it:
 * `src/hooks/use-purchase-orders-data.ts` and future PO-create forms.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/purchaseOrderSchemas.ts`, and `src/services/purchaseOrderService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Letting UI-friendly fields like `amount` leak back into the service input contract.
 */
import { addDays, formatDistanceToNow } from "date-fns";

import { jsonOk, parseJsonBody, withRouteAuth } from "@/lib/http/route";
import { purchaseOrderCreateSchema } from "@/lib/validation";
import { purchaseOrderService } from "@/services/purchaseOrderService";

export const GET = withRouteAuth(
  async (_request, _context, session) => {
    const purchaseOrders = await purchaseOrderService.listPurchaseOrders(session);

    return jsonOk(
      purchaseOrders.map((purchaseOrder) => ({
        amount: `$${purchaseOrder.totalAmount.toLocaleString()}`,
        approver: purchaseOrder.approvedAt ? "Approved" : "Pending",
        eta: formatDistanceToNow(addDays(new Date(purchaseOrder.createdAt ?? new Date().toISOString()), 7), {
          addSuffix: true,
        }),
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        requester: session.name,
        status: purchaseOrder.status,
        vendor: purchaseOrder.vendor,
      })),
    );
  },
  { permission: "purchaseOrder.read" },
);

export const POST = withRouteAuth(
  async (request, _context, session) => {
    const input = await parseJsonBody(request, purchaseOrderCreateSchema);
    const purchaseOrder = await purchaseOrderService.createPurchaseOrder(session, {
      currency: input.currency,
      lineItems: input.lineItems,
      poNumber: input.poNumber,
      quoteId: input.quoteId,
      vendorId: input.vendorId,
    });

    return jsonOk(purchaseOrder, { status: 201 });
  },
  { permission: "purchaseOrder.write" },
);

// ⚠️ SENIOR NOTE: The GET route returns UI-shaped values like formatted currency and ETA strings without weakening the
// service contract, which still speaks in domain values and status transitions.
