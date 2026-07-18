/*
What this file does: Wraps authenticated routes in the shared internal shell using the real server-side session.
What calls it: Next.js App Router for every route under `(app)`.
What it calls: `@/lib/auth/page-session` and `@/components/layout/app-shell`.
What a junior would likely get wrong: Rendering the shell with hardcoded identity data instead of deriving it from the session guard.
*/
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requirePageSession } from "@/lib/auth/page-session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requirePageSession();

  return (
    <AppShell
      organizationName={session.organizationName}
      userName={session.name}
      userRole={session.membershipRole.replace(/_/g, " ")}
    >
      {children}
    </AppShell>
  );
}

// ⚠️ SENIOR NOTE: Layout-level auth keeps every nested route behind the same session guard; if only individual pages
// enforced auth, it would be easy to miss a new route and expose data accidentally.
