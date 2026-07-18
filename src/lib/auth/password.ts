/**
 * What this file does:
 * Wraps password hashing and verification for credential-based login.
 * What calls it:
 * `src/services/authService.ts` and `src/services/seedDemoService.ts`.
 * What it calls:
 * `bcryptjs`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Comparing plaintext passwords directly or using an unsalted hash.
 */
import { compare, hash } from "bcryptjs";

export function hashPassword(password: string) {
  return hash(password, 10);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

// ⚠️ SENIOR NOTE: Password hashing cost is a security-performance tradeoff; lowering it casually for "speed" weakens the
// whole auth boundary.
