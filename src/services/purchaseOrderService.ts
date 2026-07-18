/**
 * What this file does:
 * Owns purchase-order creation, approval, and receiving workflows.
 * What calls it:
 * `src/app/api/purchase-orders/**`.
 * What it calls:
 * Purchase-order and sourcing repositories, Prisma transactions, validation guards, and audit logging.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Treating approval and receiving as simple status fields instead of guarded state transitions with quantity checks.
 */
import { PurchaseOrderStatus, ReceiptStatus } from "@prisma/client";

import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma/client";
import { assertPurchaseOrderStatusTransition } from "@/lib/validation";
import { auditLogRepository } from "@/repositories/auditLogRepository";
import { purchaseOrderRepository } from "@/repositories/purchaseOrderRepository";
import { sourcingRepository } from "@/repositories/sourcingRepository";
import { vendorRepository } from "@/repositories/vendorRepository";
import { serializePurchaseOrder } from "@/services/serializers";

function toMoneyString(value: number) {
  return value.toFixed(2);
}

export const purchaseOrderService = {
  async listPurchaseOrders(session: AuthenticatedSession) {
    const purchaseOrders = await purchaseOrderRepository.listForTenant(session.tenantId);
    return purchaseOrders.map(serializePurchaseOrder);
  },

  async createPurchaseOrder(
    session: AuthenticatedSession,
    input: {
      poNumber: string;
      vendorId: string;
      quoteId?: string;
      currency: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      let vendorId = input.vendorId;
      let currency = input.currency;
      let lineItems = input.lineItems;
      let quoteId = input.quoteId;

      if (input.quoteId) {
        const quote = await sourcingRepository.findQuoteById(session.tenantId, input.quoteId);

        if (!quote) {
          throw new NotFoundError("Quote was not found.");
        }

        if (!["SUBMITTED", "SELECTED"].includes(quote.status)) {
          throw new ConflictError("Only a submitted or selected quote can become a purchase order.");
        }

        await sourcingRepository.selectQuoteAndAwardRfq(
          session.tenantId,
          quote.id,
          quote.requestForQuoteId,
          tx,
        );

        vendorId = quote.vendorId;
        currency = quote.currency;
        quoteId = quote.id;
        lineItems = quote.lineItems.map((lineItem) => ({
          description: lineItem.description,
          quantity: lineItem.quantity,
          unitPrice: Number(lineItem.unitPrice),
        }));
      } else {
        const vendor = await vendorRepository.findById(session.tenantId, input.vendorId);

        if (!vendor) {
          throw new NotFoundError("Vendor was not found.");
        }
      }

      const totalAmount = lineItems.reduce(
        (sum, lineItem) => sum + lineItem.quantity * lineItem.unitPrice,
        0,
      );

      const purchaseOrder = await purchaseOrderRepository.create(
        {
          currency,
          lineItems: lineItems.map((lineItem) => ({
            description: lineItem.description,
            quantity: lineItem.quantity,
            unitPrice: toMoneyString(lineItem.unitPrice),
          })),
          poNumber: input.poNumber,
          quoteId,
          requestedById: session.userId,
          status: PurchaseOrderStatus.PENDING_APPROVAL,
          submittedAt: new Date(),
          tenantId: session.tenantId,
          totalAmount: toMoneyString(totalAmount),
          vendorId,
        },
        tx,
      );

      await auditLogRepository.create(
        {
          action: "purchaseOrder.created",
          actorUserId: session.userId,
          entityId: purchaseOrder.id,
          entityType: "PurchaseOrder",
          metadata: { poNumber: purchaseOrder.poNumber, quoteId },
          tenantId: session.tenantId,
        },
        tx,
      );

      return serializePurchaseOrder(purchaseOrder);
    });
  },

  async approvePurchaseOrder(session: AuthenticatedSession, purchaseOrderId: string) {
    const purchaseOrder = await purchaseOrderRepository.findById(session.tenantId, purchaseOrderId);

    if (!purchaseOrder) {
      throw new NotFoundError("Purchase order was not found.");
    }

    assertPurchaseOrderStatusTransition(purchaseOrder.status, PurchaseOrderStatus.APPROVED);

    await prisma.$transaction(async (tx) => {
      await purchaseOrderRepository.approve(session.tenantId, purchaseOrderId, session.userId, tx);

      await auditLogRepository.create(
        {
          action: "purchaseOrder.approved",
          actorUserId: session.userId,
          entityId: purchaseOrderId,
          entityType: "PurchaseOrder",
          metadata: { fromStatus: purchaseOrder.status, toStatus: PurchaseOrderStatus.APPROVED },
          tenantId: session.tenantId,
        },
        tx,
      );
    });

    const refreshed = await purchaseOrderRepository.findById(session.tenantId, purchaseOrderId);

    if (!refreshed) {
      throw new NotFoundError("Purchase order disappeared after approval.");
    }

    return serializePurchaseOrder(refreshed);
  },

  async receivePurchaseOrder(
    session: AuthenticatedSession,
    purchaseOrderId: string,
    input: {
      receivedAt: Date;
      notes?: string;
      lineItems: Array<{
        purchaseOrderLineItemId: string;
        quantityReceived: number;
        notes?: string;
      }>;
      discrepancies: Array<{
        purchaseOrderLineItemId: string;
        type: "SHORT_SHIPMENT" | "OVER_DELIVERY" | "DAMAGED" | "PRICE_MISMATCH";
        description: string;
      }>;
    },
  ) {
    const purchaseOrder = await purchaseOrderRepository.findById(session.tenantId, purchaseOrderId);

    if (!purchaseOrder) {
      throw new NotFoundError("Purchase order was not found.");
    }

    if (
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED &&
      purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new ConflictError("Only approved purchase orders can be received.");
    }

    const orderedLineItems = new Map(
      purchaseOrder.lineItems.map((lineItem) => [lineItem.id, lineItem]),
    );
    const previouslyReceivedByLineItem = new Map<string, number>();

    for (const receipt of purchaseOrder.receipts) {
      for (const lineItem of receipt.lineItems) {
        previouslyReceivedByLineItem.set(
          lineItem.purchaseOrderLineItemId,
          (previouslyReceivedByLineItem.get(lineItem.purchaseOrderLineItemId) ?? 0) +
            lineItem.quantityReceived,
        );
      }
    }

    for (const incomingLineItem of input.lineItems) {
      const orderedLineItem = orderedLineItems.get(incomingLineItem.purchaseOrderLineItemId);

      if (!orderedLineItem) {
        throw new ConflictError("Receipt references a line item that does not belong to the purchase order.");
      }

      const cumulativeQuantity =
        (previouslyReceivedByLineItem.get(incomingLineItem.purchaseOrderLineItemId) ?? 0) +
        incomingLineItem.quantityReceived;

      // The cumulative check lives before the write so repeated receipts cannot silently over-receive.
      if (cumulativeQuantity > orderedLineItem.quantity) {
        throw new ConflictError(
          `Receiving ${incomingLineItem.purchaseOrderLineItemId} would exceed the ordered quantity.`,
        );
      }
    }

    const resultingReceivedQuantities = new Map(previouslyReceivedByLineItem);

    for (const incomingLineItem of input.lineItems) {
      resultingReceivedQuantities.set(
        incomingLineItem.purchaseOrderLineItemId,
        (resultingReceivedQuantities.get(incomingLineItem.purchaseOrderLineItemId) ?? 0) +
          incomingLineItem.quantityReceived,
      );
    }

    const everyLineFullyReceived = purchaseOrder.lineItems.every(
      (lineItem) =>
        (resultingReceivedQuantities.get(lineItem.id) ?? 0) >= lineItem.quantity,
    );
    const nextStatus = everyLineFullyReceived
      ? PurchaseOrderStatus.RECEIVED
      : PurchaseOrderStatus.PARTIALLY_RECEIVED;

    assertPurchaseOrderStatusTransition(purchaseOrder.status, nextStatus);

    await prisma.$transaction(async (tx) => {
      await purchaseOrderRepository.createReceipt(
        {
          discrepancies: input.discrepancies,
          lineItems: input.lineItems,
          notes: input.notes,
          purchaseOrderId,
          receivedAt: input.receivedAt,
          receivedById: session.userId,
          status:
            input.discrepancies.length > 0
              ? ReceiptStatus.DISCREPANCY_RECORDED
              : ReceiptStatus.RECORDED,
          tenantId: session.tenantId,
        },
        tx,
      );

      await purchaseOrderRepository.updateStatus(
        session.tenantId,
        purchaseOrderId,
        nextStatus,
        everyLineFullyReceived ? input.receivedAt : undefined,
        tx,
      );

      await auditLogRepository.create(
        {
          action: "purchaseOrder.received",
          actorUserId: session.userId,
          entityId: purchaseOrderId,
          entityType: "PurchaseOrder",
          metadata: {
            discrepancyCount: input.discrepancies.length,
            fromStatus: purchaseOrder.status,
            toStatus: nextStatus,
          },
          tenantId: session.tenantId,
        },
        tx,
      );
    });

    const refreshed = await purchaseOrderRepository.findById(session.tenantId, purchaseOrderId);

    if (!refreshed) {
      throw new NotFoundError("Purchase order disappeared after receiving.");
    }

    return serializePurchaseOrder(refreshed);
  },
};

// ⚠️ SENIOR NOTE: Receiving logic must calculate cumulative quantities across prior receipts, not just validate the
// current payload, or a tenant can over-receive by sending several individually valid requests.
