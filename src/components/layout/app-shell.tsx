/*
What this file does: Provides the persistent internal-app shell with navigation, session context, and logout.
What calls it: `src/app/page.tsx` and `src/app/(app)/layout.tsx`.
What it calls: `next/link`, `next/navigation`, and the shared UI primitives.
What a junior would likely get wrong: Duplicating the sidebar in every page instead of centralizing route navigation here.
*/
"use client";

import { clsx } from "clsx";
import { BarChart3, Boxes, LayoutDashboard, LogOut, PackageSearch, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ShellNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const navigation: ShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/sourcing", label: "Sourcing", icon: PackageSearch },
  { href: "/purchase-orders", label: "Purchase Orders", icon: Boxes },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function AppShell({
  children,
  organizationName,
  userName,
  userRole,
}: {
  children: ReactNode;
  organizationName: string;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-45" />
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 p-4 lg:p-6">
        <aside className="glass-panel hidden w-72 shrink-0 flex-col rounded-[28px] p-5 lg:flex">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/70">VendorOS</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">{organizationName}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Procurement operations and reporting in one working surface.
            </p>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-sky-400/15 text-white ring-1 ring-sky-300/20"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Card className="mt-8 border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Session</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{userName}</p>
                <p className="text-sm text-slate-300">{userRole}</p>
              </div>
              <Badge tone="sky">Active</Badge>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="glass-panel rounded-[28px] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Operations console</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Procurement, approvals, and reporting
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="emerald">Role aware</Badge>
                <Badge tone="amber">Workflow guarded</Badge>
                <Badge tone="sky">Tenant-scoped</Badge>
              </div>
            </div>
          </header>

          <main className="min-w-0 pb-8">{children}</main>
        </div>
      </div>
      {/* ⚠️ SENIOR NOTE: App-shell logout must call the server route, not just navigate away, or a valid session cookie
      would remain active in the browser. */}
    </div>
  );
}
