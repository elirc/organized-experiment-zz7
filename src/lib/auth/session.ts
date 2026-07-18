/**
 * What this file does:
 * Owns session token signing, verification, hashing, and cookie naming.
 * What calls it:
 * `src/services/authService.ts`, `src/lib/http/route.ts`, and `src/lib/auth/page-session.ts`.
 * What it calls:
 * `jose`, `crypto`, and `src/lib/env.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Persisting raw session tokens in the database instead of a hash, which turns a DB leak into an account takeover event.
 */
import { createHash, randomBytes } from "crypto";
import { jwtVerify, SignJWT } from "jose";

import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "procureflow_session";

const sessionSecret = new TextEncoder().encode(env.sessionSecret);

export type SessionTokenPayload = {
  sessionId: string;
  userId: string;
  organizationId: string;
  token: string;
};

export function createOpaqueSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signSessionToken(payload: SessionTokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionSecret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, sessionSecret);

  return payload as unknown as SessionTokenPayload;
}

// ⚠️ SENIOR NOTE: JWT verification alone is not enough; we still look up the hashed opaque session in the database so
// server-side revocation works after logout or admin invalidation.
