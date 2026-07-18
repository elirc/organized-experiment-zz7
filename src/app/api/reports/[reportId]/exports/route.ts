/**
 * What this file does:
 * Queues an export job for a specific saved report.
 * What calls it:
 * Future report-builder export actions.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/reportSchemas.ts`, and `src/services/exportJobService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Accepting `reportDefinitionId` from the body instead of binding it to the route parameter.
 */
import { jsonOk, withRouteAuth, type RouteContext } from "@/lib/http/route";
import { reportExportRequestSchema } from "@/lib/validation";
import { exportJobService } from "@/services/exportJobService";

export const POST = withRouteAuth(
  async (
    request,
    context: RouteContext<{ reportId: string }>,
    session,
  ) => {
    const { reportId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = reportExportRequestSchema.parse({
      ...body,
      reportDefinitionId: reportId,
      requestedById: session.userId,
    });
    const exportJob = await exportJobService.createExportJob(session, {
      format: input.format,
      reportDefinitionId: reportId,
    });

    return jsonOk(exportJob, { status: 201 });
  },
  { permission: "report.export" },
);

// ⚠️ SENIOR NOTE: Route-param ownership is important here because export jobs should be queued against the report the URL
// identifies, not whichever ID the client chooses to send.
