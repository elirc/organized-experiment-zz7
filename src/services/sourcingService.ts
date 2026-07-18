/**
 * What this file does:
 * Handles RFQ creation and quote submission workflows.
 * What calls it:
 * `src/app/api/rfqs/route.ts` and `src/app/api/rfqs/[rfqId]/quotes/route.ts`.
 * What it calls:
 * Vendor/RFQ repositories and audit logging.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Trusting quote totals from the client instead of recalculating them from line items on the server.
 */
import { RfqStatus } from "@prisma/client";

import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import { auditLogRepository } from "@/repositories/auditLogRepository";
import { sourcingRepository } from "@/repositories/sourcingRepository";
import { vendorRepository } from "@/repositories/vendorRepository";
import { serializeRfq } from "@/services/serializers";

function toMoneyString(value: number) {
  return value.toFixed(2);
}

export const sourcingService = {
  async listRfqs(session: AuthenticatedSession) {
    const rfqs = await sourcingRepository.listRfqsForTenant(session.tenantId);
    return rfqs.map(serializeRfq);
  },

  async createRfq(
    session: AuthenticatedSession,
    input: {
      title: string;
      description?: string;
      lineItems: Array<{ description: string; quantity: number; targetUnitPrice?: number }>;
    },
  ) {
    const rfq = await sourcingRepository.createRfq({
      createdById: session.userId,
      description: input.description,
      lineItems: input.lineItems.map((lineItem) => ({
        description: lineItem.description,
        quantity: lineItem.quantity,
        targetUnitPrice:
          typeof lineItem.targetUnitPrice === "number"
            ? toMoneyString(lineItem.targetUnitPrice)
            : undefined,
      })),
      status: RfqStatus.OPEN,
      tenantId: session.tenantId,
      title: input.title,
    });

    await auditLogRepository.create({
      action: "rfq.created",
      actorUserId: session.userId,
      entityId: rfq.id,
      entityType: "RequestForQuote",
      metadata: { title: rfq.title },
      tenantId: session.tenantId,
    });

    return serializeRfq(rfq);
  },

  async createQuote(
    session: AuthenticatedSession,
    rfqId: string,
    input: {
      vendorId: string;
      validUntil: Date;
      currency: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
    },
  ) {
    const [rfq, vendor] = await Promise.all([
      sourcingRepository.findRfqById(session.tenantId, rfqId),
      vendorRepository.findById(session.tenantId, input.vendorId),
    ]);

    if (!rfq) {
      throw new NotFoundError("RFQ was not found.");
    }

    if (!vendor) {
      throw new NotFoundError("Vendor was not found.");
    }

    if (rfq.status !== RfqStatus.OPEN && rfq.status !== RfqStatus.DRAFT) {
      throw new ConflictError("Quotes can only be submitted while the RFQ is open.");
    }

    const totalAmount = input.lineItems.reduce(
      (sum, lineItem) => sum + lineItem.quantity * lineItem.unitPrice,
      0,
    );

    const quote = await sourcingRepository.createQuote({
      currency: input.currency,
      lineItems: input.lineItems.map((lineItem) => ({
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitPrice: toMoneyString(lineItem.unitPrice),
      })),
      requestForQuoteId: rfq.id,
      submittedById: session.userId,
      tenantId: session.tenantId,
      totalAmount: toMoneyString(totalAmount),
      validUntil: input.validUntil,
      vendorId: vendor.id,
    });

    await auditLogRepository.create({
      action: "quote.submitted",
      actorUserId: session.userId,
      entityId: quote.id,
      entityType: "Quote",
      metadata: { rfqId: rfq.id, vendorId: vendor.id },
      tenantId: session.tenantId,
    });

    return {
      currency: quote.currency,
      id: quote.id,
      lineItems: quote.lineItems.map((lineItem) => ({
        description: lineItem.description,
        id: lineItem.id,
        quantity: lineItem.quantity,
        unitPrice: Number(lineItem.unitPrice),
      })),
      status: quote.status,
      totalAmount: Number(quote.totalAmount),
      vendor: quote.vendor.name,
    };
  },
};

// ⚠️ SENIOR NOTE: Server-side total recomputation protects the purchasing workflow from tampered client payloads where
// line items and aggregate totals disagree.
