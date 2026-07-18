/**
 * What this file does: Validates report definitions, query filters, and export job requests.
 * What calls it: Report routes, export job routes, and analytics services.
 * What it calls: Shared primitives from `common.ts` and Zod.
 * Junior gotcha: Letting arbitrary dimensions into saved reports makes later query generation unsafe and hard to explain.
 */
import { z } from "zod";
import { currencyCodeSchema, nonEmptyTrimmedStringSchema, optionalTrimmedStringSchema } from "./common";

export const reportTypeSchema = z.enum([
  "PROCUREMENT_SPEND",
  "VENDOR_PERFORMANCE",
  "RECEIVING_DISCREPANCY",
  "PURCHASE_ORDER_PIPELINE",
  "CUSTOM",
]);

export const reportDimensionSchema = z.enum([
  "vendor",
  "vendorStatus",
  "buyer",
  "month",
  "status",
  "currency",
  "purchaseOrder",
  "rfq",
]);

export const reportMetricSchema = z.enum([
  "totalSpend",
  "poCount",
  "openPoCount",
  "receivedCount",
  "discrepancyCount",
  "averageLeadTimeDays",
]);

export const reportFilterSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  vendorIds: z.array(z.string().min(1)).optional(),
  purchaseOrderStatuses: z.array(z.string().min(1)).optional(),
  currencies: z.array(currencyCodeSchema).optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
});

export const reportDefinitionSchema = z
  .object({
    name: nonEmptyTrimmedStringSchema.max(140),
    description: optionalTrimmedStringSchema,
    reportType: reportTypeSchema,
    dimensions: z.array(reportDimensionSchema).min(1).max(5),
    metrics: z.array(reportMetricSchema).min(1).max(6),
    filters: reportFilterSchema,
  })
  .superRefine((value, ctx) => {
    if (new Set(value.dimensions).size !== value.dimensions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensions"],
        message: "Dimensions must not contain duplicates",
      });
    }

    if (new Set(value.metrics).size !== value.metrics.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metrics"],
        message: "Metrics must not contain duplicates",
      });
    }

    if (value.filters.dateFrom && value.filters.dateTo && value.filters.dateFrom > value.filters.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filters", "dateTo"],
        message: "dateTo must be on or after dateFrom",
      });
    }
  });

export const reportExportRequestSchema = z.object({
  reportDefinitionId: z.string().min(1),
  requestedById: z.string().min(1),
  format: z.enum(["CSV", "JSON"]),
});

// ⚠️ SENIOR NOTE: Report validation needs to stay narrower than the database model so saved report jobs cannot invent unsupported query shapes.
