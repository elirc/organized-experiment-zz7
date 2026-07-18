/**
 * What this file does:
 * Owns credential login, session creation/revocation, and request/page session resolution.
 * What calls it:
 * `src/app/api/auth/**`, `src/lib/http/route.ts`, and `src/lib/auth/page-session.ts`.
 * What it calls:
 * Auth repositories, password/session helpers, and app errors.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Trusting the JWT alone without confirming the backing session record still exists and is unexpired.
 */
import type { NextRequest } from "next/server";

import type { AuthenticatedSession } from "@/lib/auth/session-context";
import {
  SESSION_COOKIE_NAME,
  createOpaqueSessionToken,
  hashSessionToken,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { UnauthorizedError } from "@/lib/http/errors";
import { authRepository } from "@/repositories/authRepository";

function mapMembershipToSession(
  input: Awaited<ReturnType<typeof authRepository.findMembershipForUser>>,
  sessionId: string,
): AuthenticatedSession {
  if (!input) {
    throw new UnauthorizedError("Membership is no longer valid.");
  }

  return {
    email: input.user.email,
    membershipRole: input.role,
    name: input.user.name,
    organizationId: input.organizationId,
    organizationName: input.organization.name,
    organizationSlug: input.organization.slug,
    platformRole: input.user.platformRole,
    sessionId,
    tenantId: input.organizationId,
    userId: input.userId,
  };
}

export const authService = {
  async login(input: { email: string; password: string; organizationSlug: string }) {
    const membership = await authRepository.findMembershipByEmailAndOrganizationSlug(
      input.email,
      input.organizationSlug,
    );

    if (!membership) {
      throw new UnauthorizedError("Invalid login credentials.");
    }

    const isValidPassword = await verifyPassword(input.password, membership.user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid login credentials.");
    }

    const opaqueToken = createOpaqueSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionRecord = await authRepository.createSession({
      expiresAt,
      organizationId: membership.organizationId,
      tokenHash: hashSessionToken(opaqueToken),
      userId: membership.userId,
    });

    const signedToken = await signSessionToken({
      organizationId: membership.organizationId,
      sessionId: sessionRecord.id,
      token: opaqueToken,
      userId: membership.userId,
    });

    return {
      session: mapMembershipToSession(membership, sessionRecord.id),
      signedToken,
    };
  },

  async logout(signedToken: string | undefined) {
    if (!signedToken) {
      return;
    }

    const session = await resolveSessionFromSignedToken(signedToken);

    if (session) {
      await authRepository.deleteSessionById(session.sessionId);
    }
  },
};

export async function resolveSessionFromSignedToken(signedToken: string) {
  try {
    const payload = await verifySessionToken(signedToken);
    const sessionRecord = await authRepository.findSessionByTokenHash(hashSessionToken(payload.token));

    if (!sessionRecord) {
      return null;
    }

    if (
      sessionRecord.id !== payload.sessionId ||
      sessionRecord.userId !== payload.userId ||
      sessionRecord.organizationId !== payload.organizationId
    ) {
      return null;
    }

    if (sessionRecord.expiresAt.getTime() < Date.now()) {
      return null;
    }

    const membership = await authRepository.findMembershipForUser(
      sessionRecord.userId,
      sessionRecord.organizationId,
    );

    return mapMembershipToSession(membership, sessionRecord.id);
  } catch {
    return null;
  }
}

export async function resolveSessionFromRequest(request: NextRequest) {
  const signedToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!signedToken) {
    throw new UnauthorizedError();
  }

  const session = await resolveSessionFromSignedToken(signedToken);

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}

// ⚠️ SENIOR NOTE: The session lookup validates session ID, user ID, organization ID, and hashed opaque token together;
// dropping any one of those comparisons weakens revocation or tenant-boundary guarantees.
