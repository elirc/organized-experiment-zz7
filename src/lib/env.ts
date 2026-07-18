/**
 * What this file does:
 * Centralizes environment access for the app so auth/session code does not scatter fallback logic.
 * What calls it:
 * `src/lib/auth/session.ts`, `src/lib/prisma/client.ts`, and any runtime code that needs secrets.
 * What it calls:
 * Only `process.env`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Reading environment variables ad hoc in many files, which makes production drift hard to spot.
 */
export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/procureflow",
  sessionSecret:
    process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me",
  nodeEnv: process.env.NODE_ENV ?? "development",
};

// ⚠️ SENIOR NOTE: Silent env defaults are acceptable for a demo scaffold, but production deploys should fail fast if
// secrets are missing so the app does not start with a predictable fallback secret.
