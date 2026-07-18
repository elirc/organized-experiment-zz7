/**
 * What this file does:
 * Accepts credential login requests, validates them, and sets the signed session cookie.
 * What calls it:
 * `src/components/auth/login-page.tsx`.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/authSchemas.ts`, and `src/services/authService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Returning the token in JSON instead of setting an httpOnly cookie.
 */
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { parseJsonBody, withPublicRoute } from "@/lib/http/route";
import { loginRequestSchema } from "@/lib/validation";
import { authService } from "@/services/authService";

export const POST = withPublicRoute(async (request: NextRequest) => {
  const input = await parseJsonBody(request, loginRequestSchema);
  const result = await authService.login(input);
  const response = NextResponse.json({
    session: result.session,
  });

  response.cookies.set(SESSION_COOKIE_NAME, result.signedToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
});

// ⚠️ SENIOR NOTE: Cookie-based session issuance belongs in the route boundary so components never touch raw auth tokens.
