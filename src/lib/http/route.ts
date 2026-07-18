/**
 * What this file does:
 * Provides route wrappers for consistent auth, permission checks, and error serialization.
 * What calls it:
 * API route handlers under `src/app/api/**`.
 * What it calls:
 * `next/server`, Zod, auth resolution, permission guards, and typed app errors.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Repeating auth/try-catch/validation code in every route, which guarantees drift.
 */
import { ZodError, type ZodType } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { assertPermission, type AppPermission } from "@/lib/auth/permissions";
import { AppError, ValidationBoundaryError } from "@/lib/http/errors";
import { resolveSessionFromRequest } from "@/services/authService";

export type RouteContext<TParams extends Record<string, string> = Record<string, string>> = {
  params: Promise<TParams>;
};

type AuthenticatedRouteHandler<TParams extends Record<string, string>> = (
  request: NextRequest,
  context: RouteContext<TParams>,
  session: AuthenticatedSession,
) => Promise<Response>;

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
) {
  const rawBody = await request.json();

  try {
    return schema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationBoundaryError(error.issues[0]?.message ?? "Invalid request body.");
    }

    throw error;
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { error: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
    { status: 500 },
  );
}

export function withRouteAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedRouteHandler<TParams>,
  options?: { permission?: AppPermission },
) {
  return async (request: NextRequest, context: RouteContext<TParams>) => {
    try {
      const session = await resolveSessionFromRequest(request);

      if (options?.permission) {
        // Route-level permission guards keep handlers focused on business inputs instead of auth boilerplate.
        assertPermission(session, options.permission);
      }

      return await handler(request, context, session);
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

export function withPublicRoute<TParams extends Record<string, string> = Record<string, string>>(
  handler: (request: NextRequest, context: RouteContext<TParams>) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext<TParams>) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

// ⚠️ SENIOR NOTE: If auth and error handling are not wrapped together, routes tend to return different shapes for the
// same class of failure, which makes frontend behavior and logging brittle.
