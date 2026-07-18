/**
 * What this file does:
 * Persists RFQs and vendor quotes, including the quote-selection transition used before PO creation.
 * What calls it:
 * `src/services/sourcingService.ts` and `src/services/purchaseOrderService.ts`.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Selecting a quote without updating sibling quotes or the parent RFQ, leaving contradictory workflow state behind.
 */
import { QuoteStatus, RfqStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma/client";
import type { RepositoryClient } from "@/repositories/repository-types";

function getDb(client?: RepositoryClient) {
  return client ?? prisma;
}

export const sourcingRepository = {
  listRfqsForTenant(tenantId: string) {
    return prisma.requestForQuote.findMany({
      where: {
        // Every tenant-owned RFQ query stays explicitly scoped.
        tenantId,
      },
      include: {
        createdBy: true,
        lineItems: true,
        quotes: {
          include: {
            lineItems: true,
            vendor: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  },

  createRfq(
    input: {
      tenantId: string;
      title: string;
      description?: string;
      status: RfqStatus;
      createdById: string;
      lineItems: Array<{ description: string; quantity: number; targetUnitPrice?: string }>;
    },
    client?: RepositoryClient,
  ) {
    return getDb(client).requestForQuote.create({
      data: {
        createdById: input.createdById,
        description: input.description,
        status: input.status,
        tenantId: input.tenantId,
        title: input.title,
        lineItems: {
          create: input.lineItems.map((lineItem) => ({
            description: lineItem.description,
            quantity: lineItem.quantity,
            targetUnitPrice: lineItem.targetUnitPrice,
          })),
        },
      },
      include: {
        createdBy: true,
        lineItems: true,
        quotes: {
          include: {
            lineItems: true,
            vendor: true,
          },
        },
      },
    });
  },

  findRfqById(tenantId: string, rfqId: string) {
    return prisma.requestForQuote.findFirst({
      where: {
        id: rfqId,
        // RFQ access is tenant-scoped even for child actions like quote creation.
        tenantId,
      },
      include: {
        lineItems: true,
        quotes: true,
      },
    });
  },

  createQuote(
    input: {
      tenantId: string;
      requestForQuoteId: string;
      vendorId: string;
      submittedById: string;
      validUntil: Date;
      totalAmount: string;
      currency: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: string }>;
    },
    client?: RepositoryClient,
  ) {
    return getDb(client).quote.create({
      data: {
        currency: input.currency,
        requestForQuoteId: input.requestForQuoteId,
        status: QuoteStatus.SUBMITTED,
        submittedById: input.submittedById,
        tenantId: input.tenantId,
        totalAmount: input.totalAmount,
        validUntil: input.validUntil,
        vendorId: input.vendorId,
        lineItems: {
          create: input.lineItems.map((lineItem) => ({
            description: lineItem.description,
            quantity: lineItem.quantity,
            unitPrice: lineItem.unitPrice,
          })),
        },
      },
      include: {
        lineItems: true,
        requestForQuote: true,
        vendor: true,
      },
    });
  },

  findQuoteById(tenantId: string, quoteId: string) {
    return prisma.quote.findFirst({
      where: {
        id: quoteId,
        // Quote ownership has to be verified independently from the parent RFQ to prevent ID swapping.
        tenantId,
      },
      include: {
        lineItems: true,
        requestForQuote: {
          include: {
            lineItems: true,
          },
        },
        vendor: true,
      },
    });
  },

  async selectQuoteAndAwardRfq(
    tenantId: string,
    quoteId: string,
    rfqId: string,
    client?: RepositoryClient,
  ) {
    const db = getDb(client);

    await db.quote.updateMany({
      where: {
        requestForQuoteId: rfqId,
        // Sibling quote updates must be tenant-scoped so another tenant's RFQ cannot be altered by accident.
        tenantId,
      },
      data: {
        status: QuoteStatus.REJECTED,
      },
    });

    await db.quote.updateMany({
      where: {
        id: quoteId,
        requestForQuoteId: rfqId,
        tenantId,
      },
      data: {
        status: QuoteStatus.SELECTED,
      },
    });

    return db.requestForQuote.updateMany({
      where: {
        id: rfqId,
        tenantId,
      },
      data: {
        status: RfqStatus.AWARDED,
      },
    });
  },
};

// ⚠️ SENIOR NOTE: Quote selection is a multi-record state transition. If only the chosen quote changes status, the RFQ
// can still look open and competing quotes can stay "submitted", which breaks downstream purchasing logic.
