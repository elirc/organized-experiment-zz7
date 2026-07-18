/**
 * What this file does:
 * Lists export jobs independently from the combined reports screen.
 * What calls it:
 * Future export monitoring or admin views.
 * What it calls:
 * `src/services/exportJobService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Reaching into the export repository directly from the route instead of using the service-level queue contract.
 */
import { jsonOk, withRouteAuth } from "@/lib/http/route";
import { exportJobService } from "@/services/exportJobService";

export const GET = withRouteAuth(
  async (_request, _context, session) => {
    const exportJobs = await exportJobService.listExportJobs(session);
    return jsonOk(exportJobs);
  },
  { permission: "report.read" },
);

// ⚠️ SENIOR NOTE: A separate export-job listing route keeps monitoring concerns independent from report-definition CRUD.
