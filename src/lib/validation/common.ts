/**
 * What this file does: Shares low-level validation primitives used by the domain-specific schemas.
 * What calls it: `authSchemas.ts`, `vendorSchemas.ts`, `rfqSchemas.ts`, `purchaseOrderSchemas.ts`, and `reportSchemas.ts`.
 * What it calls: Zod primitives only.
 * Junior gotcha: Repeating the same min/max/date rules across files leads to subtle drift in API contracts.
 */
import { z } from "zod";

export const cuidLikeIdSchema = z.string().min(1).max(64);
export const tenantIdSchema = cuidLikeIdSchema;
export const isoDateSchema = z.coerce.date();
export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);
export const pageSchema = z.coerce.number().int().min(1).default(1);
export const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "Expected a 3-letter ISO currency code");
export const moneySchema = z.coerce.number().finite();
export const nonEmptyTrimmedStringSchema = z.string().trim().min(1);
export const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .max(2000)
  .optional();

// ⚠️ SENIOR NOTE: This file is the contract floor for the whole app, so loosening these helpers can quietly widen every route.
