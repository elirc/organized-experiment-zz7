/**
 * What this file does:
 * Persists saved report definitions and tenant-scoped export job listings.
 * What calls it:
 * `src/services/reportService.ts` and `src/services/exportJobService.ts`.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Treating report definitions as harmless metadata and forgetting they still need tenant scoping.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

export const reportRepository = {
  listDefinitionsForTenant(tenantId: string) {
    return prisma.reportDefinition.findMany({
      where: {
        // Saved report definitions are tenant-owned because filters can reveal organizational structure.
        tenantId,
      },
      include: {
        createdBy: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  },

  createDefinition(input: {
    tenantId: string;
    name: string;
    description?: string;
    reportType:
      | "PROCUREMENT_SPEND"
      | "VENDOR_PERFORMANCE"
      | "RECEIVING_DISCREPANCY"
      | "PURCHASE_ORDER_PIPELINE"
      | "CUSTOM";
    dimensions: string[];
    metrics: string[];
    filters: Prisma.InputJsonValue;
    createdById: string;
  }) {
    return prisma.reportDefinition.create({
      data: input,
      include: {
        createdBy: true,
      },
    });
  },

  findDefinitionById(tenantId: string, reportDefinitionId: string) {
    return prisma.reportDefinition.findFirst({
      where: {
        id: reportDefinitionId,
        tenantId,
      },
      include: {
        createdBy: true,
      },
    });
  },

  listExportJobsForTenant(tenantId: string) {
    return prisma.exportJob.findMany({
      where: {
        tenantId,
      },
      include: {
        reportDefinition: true,
        requestedBy: true,
      },
      orderBy: [{ requestedAt: "desc" }],
    });
  },
};

// ⚠️ SENIOR NOTE: Report definitions often feel "meta", but filters and dimensions can encode highly sensitive business
// slices, so tenant scoping here is just as important as on transactional tables.
