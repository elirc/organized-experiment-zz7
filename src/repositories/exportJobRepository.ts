/**
 * What this file does:
 * Stores and advances export-job lifecycle state.
 * What calls it:
 * `src/services/exportJobService.ts`.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Marking jobs as complete without first recording a running state, which hides stuck-job behavior in production.
 */
import { ExportJobStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma/client";
import type { RepositoryClient } from "@/repositories/repository-types";

function getDb(client?: RepositoryClient) {
  return client ?? prisma;
}

export const exportJobRepository = {
  create(
    input: {
      tenantId: string;
      reportDefinitionId: string;
      requestedById: string;
      format: "CSV" | "JSON";
      snapshot: Prisma.InputJsonValue;
    },
    client?: RepositoryClient,
  ) {
    return getDb(client).exportJob.create({
      data: {
        ...input,
        status: ExportJobStatus.PENDING,
      },
      include: {
        reportDefinition: true,
        requestedBy: true,
      },
    });
  },

  listForTenant(tenantId: string) {
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

  findPendingBatch(tenantId: string, limit = 10) {
    return prisma.exportJob.findMany({
      where: {
        tenantId,
        status: ExportJobStatus.PENDING,
      },
      include: {
        reportDefinition: true,
      },
      orderBy: [{ requestedAt: "asc" }],
      take: limit,
    });
  },

  markRunning(exportJobId: string, client?: RepositoryClient) {
    return getDb(client).exportJob.update({
      where: { id: exportJobId },
      data: {
        startedAt: new Date(),
        status: ExportJobStatus.RUNNING,
      },
    });
  },

  markSucceeded(
    exportJobId: string,
    input: { fileName: string; rowCount: number; snapshot: Prisma.InputJsonValue },
    client?: RepositoryClient,
  ) {
    return getDb(client).exportJob.update({
      where: { id: exportJobId },
      data: {
        completedAt: new Date(),
        fileName: input.fileName,
        rowCount: input.rowCount,
        snapshot: input.snapshot,
        status: ExportJobStatus.SUCCEEDED,
      },
    });
  },

  markFailed(exportJobId: string, errorMessage: string, client?: RepositoryClient) {
    return getDb(client).exportJob.update({
      where: { id: exportJobId },
      data: {
        completedAt: new Date(),
        errorMessage,
        status: ExportJobStatus.FAILED,
      },
    });
  },
};

// ⚠️ SENIOR NOTE: Export jobs are operational records, not just UX artifacts; if their state machine is sloppy, support
// teams lose the ability to answer whether a report was queued, running, failed, or never attempted.
