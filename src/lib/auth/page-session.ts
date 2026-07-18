/**
 * What this file does:
 * Resolves and enforces an authenticated session for server-rendered pages.
 * What calls it:
 * `src/app/(app)/layout.tsx` and other server components that need tenant/user context.
 * What it calls:
 * `next/headers`, `next/navigation`, `src/lib/auth/session.ts`, and `src/services/authService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Doing auth redirects in every page instead of one reusable guard utility.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resolveSessionFromSignedToken } from "@/services/authService";

export async function requirePageSession() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!signedToken) {
    redirect("/login");
  }

  const session = await resolveSessionFromSignedToken(signedToken);

  if (!session) {
    redirect("/login");
  }

  return session;
}

// ⚠️ SENIOR NOTE: Page auth and API auth should resolve through the same service so a logout or role change cannot leave
// one surface protected and the other stale.
