/**
 * What this file does:
 * Handles tenant-scoped vendor queries and writes.
 * What calls it:
 * `src/services/vendorService.ts` and reporting services that need vendor context.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Querying vendors by `id` alone and forgetting the tenant scope on a shared table.
 */
import { prisma } from "@/lib/prisma/client";

export const vendorRepository = {
  listForTenant(tenantId: string) {
    return prisma.vendor.findMany({
      where: {
        // Tenant scope lives in the repository so every caller inherits isolation by default.
        tenantId,
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  },

  create(input: {
    tenantId: string;
    name: string;
    code: string;
    paymentTerms: string;
    country: string;
    contactEmail: string;
  }) {
    return prisma.vendor.create({
      data: input,
    });
  },

  findById(tenantId: string, vendorId: string) {
    return prisma.vendor.findFirst({
      where: {
        id: vendorId,
        // Tenant scope prevents cross-organization foreign-key reuse.
        tenantId,
      },
    });
  },
};

// ⚠️ SENIOR NOTE: Vendor lookup is a common child-entity leak point because downstream objects like quotes and POs often
// reference vendor IDs that "look unique enough" even when they belong to another tenant.
