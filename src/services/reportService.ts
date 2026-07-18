/**
 * What this file does:
 * Owns saved report definition lifecycle and export-job listing.
 * What calls it:
 * `src/app/api/reports/route.ts` and `src/app/api/export-jobs/route.ts`.
 * What it calls:
 * Report/export repositories and audit logging.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Putting report-definition writes in the route and forgetting they need the same auditability as operational data.
 */
import type { Prisma } from "@prisma/client";
import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { NotFoundError } from "@/lib/http/errors";
import { auditLogRepository } from "@/repositories/auditLogRepository";
import { reportRepository } from "@/repositories/reportRepository";
import { serializeExportJob, serializeReportDefinition } from "@/services/serializers";

export const reportService = {
  async listReports(session: AuthenticatedSession) {
    const reports = await reportRepository.listDefinitionsForTenant(session.tenantId);
    return reports.map(serializeReportDefinition);
  },

  async createReport(
    session: AuthenticatedSession,
    input: {
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
    },
  ) {
    const reportDefinition = await reportRepository.createDefinition({
      ...input,
      createdById: session.userId,
      tenantId: session.tenantId,
    });

    await auditLogRepository.create({
      action: "reportDefinition.created",
      actorUserId: session.userId,
      entityId: reportDefinition.id,
      entityType: "ReportDefinition",
      metadata: { reportType: reportDefinition.reportType },
      tenantId: session.tenantId,
    });

    return serializeReportDefinition(reportDefinition);
  },

  async getReport(session: AuthenticatedSession, reportDefinitionId: string) {
    const reportDefinition = await reportRepository.findDefinitionById(
      session.tenantId,
      reportDefinitionId,
    );

    if (!reportDefinition) {
      throw new NotFoundError("Report definition was not found.");
    }

    return serializeReportDefinition(reportDefinition);
  },

  async listExportJobs(session: AuthenticatedSession) {
    const exportJobs = await reportRepository.listExportJobsForTenant(session.tenantId);
    return exportJobs.map(serializeExportJob);
  },
};

// ⚠️ SENIOR NOTE: Saved report definitions are part of the product's business surface; if they are not audited, analysts
// can change filters that affect downstream exports with no review trail.
