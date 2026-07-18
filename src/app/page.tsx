/*
What this file does: Renders the authenticated dashboard home at `/`.
What calls it: Next.js when users land on `/`.
What it calls: `@/lib/auth/page-session`, `@/components/layout/app-shell`, and `@/components/dashboard/dashboard-page`.
What a junior would likely get wrong: Leaving `/` outside the auth boundary even after the rest of the app is protected.
*/
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AppShell } from "@/components/layout/app-shell";
import { requirePageSession } from "@/lib/auth/page-session";

export default async function HomePage() {
  const session = await requirePageSession();

  return (
    <AppShell
      organizationName={session.organizationName}
      userName={session.name}
      userRole={session.membershipRole.replace(/_/g, " ")}
    >
      <DashboardPage />
    </AppShell>
  );
}
