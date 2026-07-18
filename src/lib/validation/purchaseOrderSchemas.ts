/**
 * What this file does: Validates purchase order creation, approval, receiving, and status transitions.
 * What calls it: Purchase order routes and procurement workflow services.
 * What it calls: Shared primitives from `common.ts` and Zod.
 * Junior gotcha: Receiving and approval are different actions; mixing them together creates broken auditability.
 */
import { z } from "zod";
import { currencyCodeSchema, moneySchema, nonEmptyTrimmedStringSchema, optionalTrimmedStringSchema } from "./common";

export const purchaseOrderStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
]);

export const receiptStatusSchema = z.enum(["RECORDED", "DISCREPANCY_RECORDED"]);

export const discrepancyTypeSchema = z.enum([
  "SHORT_SHIPMENT",
  "OVER_DELIVERY",
  "DAMAGED",
  "PRICE_MISMATCH",
]);

export const purchaseOrderLineItemSchema = z.object({
  description: nonEmptyTrimmedStringSchema.max(240),
  quantity: z.coerce.number().int().positive(),
  unitPrice: moneySchema,
});

export const purchaseOrderCreateSchema = z.object({
  poNumber: z.string().trim().min(1).max(40),
  vendorId: z.string().min(1),
  quoteId: z.string().min(1).optional(),
  currency: currencyCodeSchema,
  lineItems: z.array(purchaseOrderLineItemSchema).min(1),
  notes: optionalTrimmedStringSchema,
});

export const purchaseOrderApproveSchema = z.object({
  purchaseOrderId: z.string().min(1),
  approverUserId: z.string().min(1),
  approvedAt: z.coerce.date(),
  notes: optionalTrimmedStringSchema,
});

export const receiptLineItemSchema = z.object({
  purchaseOrderLineItemId: z.string().min(1),
  quantityReceived: z.coerce.number().int().nonnegative(),
  notes: optionalTrimmedStringSchema,
});

export const purchaseOrderReceiveSchema = z.object({
  purchaseOrderId: z.string().min(1),
  receivedById: z.string().min(1),
  receivedAt: z.coerce.date(),
  status: receiptStatusSchema,
  notes: optionalTrimmedStringSchema,
  lineItems: z.array(receiptLineItemSchema).min(1),
  discrepancies: z
    .array(
      z.object({
        purchaseOrderLineItemId: z.string().min(1),
        type: discrepancyTypeSchema,
        description: nonEmptyTrimmedStringSchema.max(500),
      }),
    )
    .default([]),
});

const purchaseOrderTransitionMap: Record<
  z.infer<typeof purchaseOrderStatusSchema>,
  ReadonlySet<z.infer<typeof purchaseOrderStatusSchema>>
> = {
  DRAFT: new Set(["PENDING_APPROVAL", "CANCELLED"]),
  PENDING_APPROVAL: new Set(["APPROVED", "CANCELLED"]),
  APPROVED: new Set(["PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"]),
  PARTIALLY_RECEIVED: new Set(["RECEIVED", "CLOSED"]),
  RECEIVED: new Set(["CLOSED"]),
  CLOSED: new Set([]),
  CANCELLED: new Set([]),
};

export function assertPurchaseOrderStatusTransition(
  fromStatus: z.infer<typeof purchaseOrderStatusSchema>,
  toStatus: z.infer<typeof purchaseOrderStatusSchema>,
) {
  if (!purchaseOrderTransitionMap[fromStatus].has(toStatus)) {
    throw new Error(`Invalid purchase order transition from ${fromStatus} to ${toStatus}`);
  }

  return true;
}

// ⚠️ SENIOR NOTE: Approval is intentionally a separate transition because collapsing it into receiving can bypass finance controls.
