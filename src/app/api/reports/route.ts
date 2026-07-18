/**
 * What this file does:
 * Lists saved reports/export jobs and creates new report definitions.
 * What calls it:
 * `src/hooks/use-reports-data.ts` and future report-builder save actions.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/reportSchemas.ts`, `src/services/reportService.ts`, and `src/services/exportJobService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Creating a second endpoint for exports even though this page needs both definitions and jobs together.
 */
import { jsonOk, parseJsonBody, withRouteAuth } from "@/lib/http/route";
import { reportDefinitionSchema } from "@/lib/validation";
import { exportJobService } from "@/services/exportJobService";
import { reportService } from "@/services/reportService";

export const GET = withRouteAuth(
  async (_request, _context, session) => {
    const [reports, exports] = await Promise.all([
      reportService.listReports(session),
      exportJobService.listExportJobs(session),
    ]);

    return jsonOk({
      exports: exports.map((job) => ({
        format: job.format,
        id: job.id,
        reportName: job.reportName,
        requestedAt: job.requestedAt.slice(0, 16).replace("T", " "),
        requestedBy: job.requestedBy,
        rows: job.rowCount ?? 0,
        status: job.status,
      })),
      reports: reports.map((report) => ({
        dimensions: report.dimensions,
        filters: JSON.stringify(report.filters),
        id: report.id,
        metrics: report.metrics,
        name: report.name,
        owner: report.createdBy,
        reportType: report.reportType,
        updatedAt: report.createdAt.slice(0, 10),
      })),
    });
  },
  { permission: "report.read" },
);

export const POST = withRouteAuth(
  async (request, _context, session) => {
    const input = await parseJsonBody(request, reportDefinitionSchema);
    const report = await reportService.createReport(session, input);
    return jsonOk(report, { status: 201 });
  },
  { permission: "report.manage" },
);

// ⚠️ SENIOR NOTE: The reports route returns both report definitions and export jobs because the UI treats them as one
// screen, but the business logic still stays separated in distinct services.
