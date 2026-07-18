/**
 * What this file does:
 * Owns tenant-scoped persistence for purchase orders, approvals, and receipts.
 * What calls it:
 * `src/services/purchaseOrderService.ts`, reporting services, and dashboard services.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Updating PO status without loading existing receipts, which makes quantity validation impossible.
 */
import { PurchaseOrderStatus, ReceiptStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma/client";
import type { RepositoryClient } from "@/repositories/repository-types";

function getDb(client?: RepositoryClient) {
  return client ?? prisma;
}

export const purchaseOrderRepository = {
  listForTenant(tenantId: string) {
    return prisma.purchaseOrder.findMany({
      where: {
        // Purchase-order reads stay tenant-bound because they fan out to vendors, receipts, and line items.
        tenantId,
      },
      include: {
        approvedBy: true,
        lineItems: true,
        requestedBy: true,
        vendor: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  },

  findById(tenantId: string, purchaseOrderId: string) {
    return prisma.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        tenantId,
      },
      include: {
        lineItems: true,
        receipts: {
          include: {
            discrepancies: true,
            lineItems: true,
          },
        },
        vendor: true,
      },
    });
  },

  create(
    input: {
      tenantId: string;
      poNumber: string;
      vendorId: string;
      quoteId?: string;
      requestedById: string;
      currency: string;
      totalAmount: string;
      status: PurchaseOrderStatus;
      submittedAt?: Date;
      lineItems: Array<{ description: string; quantity: number; unitPrice: string }>;
    },
    client?: RepositoryClient,
  ) {
    return getDb(client).purchaseOrder.create({
      data: {
        currency: input.currency,
        poNumber: input.poNumber,
        quoteId: input.quoteId,
        requestedById: input.requestedById,
        status: input.status,
        submittedAt: input.submittedAt,
        tenantId: input.tenantId,
        totalAmount: input.totalAmount,
        vendorId: input.vendorId,
        lineItems: {
          create: input.lineItems,
        },
      },
      include: {
        lineItems: true,
        vendor: true,
      },
    });
  },

  approve(
    tenantId: string,
    purchaseOrderId: string,
    approvedById: string,
    client?: RepositoryClient,
  ) {
    return getDb(client).purchaseOrder.updateMany({
      where: {
        id: purchaseOrderId,
        tenantId,
      },
      data: {
        approvedAt: new Date(),
        approvedById,
        status: PurchaseOrderStatus.APPROVED,
      },
    });
  },

  updateStatus(
    tenantId: string,
    purchaseOrderId: string,
    status: PurchaseOrderStatus,
    receivedAt: Date | undefined,
    client?: RepositoryClient,
  ) {
    return getDb(client).purchaseOrder.updateMany({
      where: {
        id: purchaseOrderId,
        tenantId,
      },
      data: {
        receivedAt,
        status,
      },
    });
  },

  createReceipt(
    input: {
      tenantId: string;
      purchaseOrderId: string;
      receivedById: string;
      receivedAt: Date;
      status: ReceiptStatus;
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
    client?: RepositoryClient,
  ) {
    return getDb(client).receipt.create({
      data: {
        notes: input.notes,
        purchaseOrderId: input.purchaseOrderId,
        receivedAt: input.receivedAt,
        receivedById: input.receivedById,
        status: input.status,
        tenantId: input.tenantId,
        lineItems: {
          create: input.lineItems,
        },
        discrepancies: {
          create: input.discrepancies.map((discrepancy) => ({
            description: discrepancy.description,
            purchaseOrderLineItemId: discrepancy.purchaseOrderLineItemId,
            tenantId: input.tenantId,
            type: discrepancy.type,
          })),
        },
      },
      include: {
        discrepancies: true,
        lineItems: true,
      },
    });
  },
};

// ⚠️ SENIOR NOTE: Receipt creation must preserve the ordered line-item IDs; if receiving accepts arbitrary descriptions
// instead, quantity controls and discrepancy history become impossible to trust.
