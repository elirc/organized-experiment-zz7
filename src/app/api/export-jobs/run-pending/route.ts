/**
 * What this file does:
 * Processes the current tenant's pending export jobs.
 * What calls it:
 * Future operator actions or demo-background-job controls.
 * What it calls:
 * `src/services/exportJobService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Running every tenant's pending jobs in one request, which breaks isolation and audit clarity.
 */
import { jsonOk, withRouteAuth } from "@/lib/http/route";
import { exportJobService } from "@/services/exportJobService";

export const POST = withRouteAuth(
  async (_request, _context, session) => {
    const processed = await exportJobService.runPendingJobs(session);
    return jsonOk({ processed });
  },
  { permission: "report.export" },
);

// ⚠️ SENIOR NOTE: Even demo job runners should stay tenant-scoped so the execution path teaches the same isolation rules
// the real background worker would need.
