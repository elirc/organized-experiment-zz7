/**
 * What this file does: Validates vendor CRUD payloads and vendor query parameters.
 * What calls it: Vendor routes and vendor service methods.
 * What it calls: Shared primitives from `common.ts` and Zod.
 * Junior gotcha: Letting free-form strings through for codes and contact fields makes later dedupe and filtering brittle.
 */
import { z } from "zod";
import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
  pageSchema,
  pageSizeSchema,
} from "./common";

export const vendorStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ON_HOLD"]);

export const vendorCreateSchema = z.object({
  name: nonEmptyTrimmedStringSchema.max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z0-9_-]+$/.test(value), "Vendor code may only contain uppercase letters, numbers, _ or -"),
  status: vendorStatusSchema.default("ACTIVE"),
  paymentTerms: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(80),
  contactEmail: z.string().trim().email(),
});

export const vendorUpdateSchema = vendorCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const vendorListQuerySchema = z.object({
  search: optionalTrimmedStringSchema,
  status: vendorStatusSchema.optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;

// ⚠️ SENIOR NOTE: Code normalization happens here so the database does not end up with visually duplicated vendor codes.
