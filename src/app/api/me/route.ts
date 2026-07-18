/**
 * What this file does:
 * Returns the authenticated session context for client-side session-aware UI.
 * What calls it:
 * Potential future hooks and session-aware client components.
 * What it calls:
 * `src/lib/http/route.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Duplicating auth resolution in components instead of using one server endpoint.
 */
import { jsonOk, withRouteAuth } from "@/lib/http/route";

export const GET = withRouteAuth(async (_request, _context, session) => {
  return jsonOk(session);
});

// ⚠️ SENIOR NOTE: This route should return only the minimum session context needed by the UI, not full user records.
