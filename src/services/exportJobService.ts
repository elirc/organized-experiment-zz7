/**
 * What this file does:
 * Queues report exports and processes pending jobs for a tenant.
 * What calls it:
 * `src/app/api/reports/[reportId]/exports/route.ts` and `src/app/api/export-jobs/run-pending/route.ts`.
 * What it calls:
 * Report/export repositories, analytics read models, and audit logging.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Generating the export synchronously in the request that queues it, which defeats the async boundary entirely.
 */
import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { NotFoundError } from "@/lib/http/errors";
import { auditLogRepository } from "@/repositories/auditLogRepository";
import { dashboardRepository } from "@/repositories/dashboardRepository";
import { exportJobRepository } from "@/repositories/exportJobRepository";
import { reportRepository } from "@/repositories/reportRepository";
import { serializeExportJob } from "@/services/serializers";

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export const exportJobService = {
  async createExportJob(
    session: AuthenticatedSession,
    input: { reportDefinitionId: string; format: "CSV" | "JSON" },
  ) {
    const reportDefinition = await reportRepository.findDefinitionById(
      session.tenantId,
      input.reportDefinitionId,
    );

    if (!reportDefinition) {
      throw new NotFoundError("Report definition was not found.");
    }

    const exportJob = await exportJobRepository.create({
      format: input.format,
      reportDefinitionId: reportDefinition.id,
      requestedById: session.userId,
      snapshot: {
        dimensions: reportDefinition.dimensions,
        filters: reportDefinition.filters,
        metrics: reportDefinition.metrics,
        reportName: reportDefinition.name,
      },
      tenantId: session.tenantId,
    });

    await auditLogRepository.create({
      action: "exportJob.queued",
      actorUserId: session.userId,
      entityId: exportJob.id,
      entityType: "ExportJob",
      metadata: { format: exportJob.format, reportDefinitionId: reportDefinition.id },
      tenantId: session.tenantId,
    });

    return serializeExportJob(exportJob);
  },

  async listExportJobs(session: AuthenticatedSession) {
    const exportJobs = await exportJobRepository.listForTenant(session.tenantId);
    return exportJobs.map(serializeExportJob);
  },

  async runPendingJobs(session: AuthenticatedSession) {
    const pendingJobs = await exportJobRepository.findPendingBatch(session.tenantId, 10);
    const processedJobIds: string[] = [];

    for (const pendingJob of pendingJobs) {
      try {
        await exportJobRepository.markRunning(pendingJob.id);

        const filters = (pendingJob.reportDefinition.filters as {
          currencies?: string[];
          dateFrom?: Date;
          dateTo?: Date;
          minAmount?: number;
          purchaseOrderStatuses?: string[];
          vendorIds?: string[];
        }) ?? {};

        const rows = await dashboardRepository.buildRowsForReport(session.tenantId, {
          filters,
          reportType: pendingJob.reportDefinition.reportType,
        });

        const completed = await exportJobRepository.markSucceeded(pendingJob.id, {
          fileName: `${pendingJob.reportDefinition.name
            .toLowerCase()
            .replace(/\s+/g, "-")}-${timestampSuffix()}.${pendingJob.format.toLowerCase()}`,
          rowCount: rows.length,
          snapshot: {
            preview: rows.slice(0, 10),
            rowCount: rows.length,
          },
        });

        await auditLogRepository.create({
          action: "exportJob.completed",
          actorUserId: session.userId,
          entityId: completed.id,
          entityType: "ExportJob",
          metadata: { rowCount: rows.length },
          tenantId: session.tenantId,
        });

        processedJobIds.push(completed.id);
      } catch (error) {
        await exportJobRepository.markFailed(
          pendingJob.id,
          error instanceof Error ? error.message : "Unknown export failure",
        );
      }
    }

    const exportJobs = await exportJobRepository.listForTenant(session.tenantId);

    return exportJobs
      .filter((exportJob) => processedJobIds.includes(exportJob.id))
      .map(serializeExportJob);
  },
};

// ⚠️ SENIOR NOTE: The queueing route and the processing route are intentionally separate; if those boundaries collapse,
// a slow export can turn a normal user action into a timeout and duplicate-job risk.
