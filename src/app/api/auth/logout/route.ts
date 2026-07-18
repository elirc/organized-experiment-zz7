/**
 * What this file does:
 * Revokes the current session and clears the session cookie.
 * What calls it:
 * The sign-out affordance in `src/components/layout/app-shell.tsx`.
 * What it calls:
 * `src/services/authService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Clearing the cookie without deleting the backing session row.
 */
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { withPublicRoute } from "@/lib/http/route";
import { authService } from "@/services/authService";

export const POST = withPublicRoute(async (request: NextRequest) => {
  await authService.logout(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return response;
});

// ⚠️ SENIOR NOTE: Logout needs both cookie clearing and server-side revocation; doing only one creates confusing ghost sessions.
