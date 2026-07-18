/**
 * What this file does: Validates RFQ creation, quote submission, and RFQ lifecycle transitions.
 * What calls it: RFQ routes, quote routes, and purchasing workflow services.
 * What it calls: Shared primitives from `common.ts` and Zod.
 * Junior gotcha: Treating RFQs like flat CRUD misses the state transitions that prevent late quote edits.
 */
import { z } from "zod";
import { currencyCodeSchema, moneySchema, nonEmptyTrimmedStringSchema, optionalTrimmedStringSchema } from "./common";

export const rfqStatusSchema = z.enum(["DRAFT", "OPEN", "AWARDED", "CLOSED"]);
export const quoteStatusSchema = z.enum(["DRAFT", "SUBMITTED", "SELECTED", "REJECTED", "EXPIRED"]);

export const rfqLineItemSchema = z.object({
  description: nonEmptyTrimmedStringSchema.max(240),
  quantity: z.coerce.number().int().positive(),
  targetUnitPrice: moneySchema.optional(),
});

export const rfqCreateSchema = z.object({
  title: nonEmptyTrimmedStringSchema.max(180),
  description: optionalTrimmedStringSchema,
  lineItems: z.array(rfqLineItemSchema).min(1),
});

export const rfqUpdateSchema = rfqCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const quoteSubmitSchema = z.object({
  rfqId: z.string().min(1),
  vendorId: z.string().min(1),
  submittedById: z.string().min(1),
  currency: currencyCodeSchema,
  totalAmount: moneySchema,
  validUntil: z.coerce.date(),
  lineItems: z.array(
    z.object({
      description: nonEmptyTrimmedStringSchema.max(240),
      quantity: z.coerce.number().int().positive(),
      unitPrice: moneySchema,
    }),
  ).min(1),
});

const rfqTransitionMap: Record<z.infer<typeof rfqStatusSchema>, ReadonlySet<z.infer<typeof rfqStatusSchema>>> = {
  DRAFT: new Set(["OPEN", "CLOSED"]),
  OPEN: new Set(["AWARDED", "CLOSED"]),
  AWARDED: new Set(["CLOSED"]),
  CLOSED: new Set([]),
};

export function assertRfqStatusTransition(
  fromStatus: z.infer<typeof rfqStatusSchema>,
  toStatus: z.infer<typeof rfqStatusSchema>,
) {
  if (!rfqTransitionMap[fromStatus].has(toStatus)) {
    throw new Error(`Invalid RFQ transition from ${fromStatus} to ${toStatus}`);
  }

  return true;
}

// ⚠️ SENIOR NOTE: RFQ closing is irreversible here, so a missing guard would let late edits silently corrupt quote history.
