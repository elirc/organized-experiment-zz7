/*
What this file does: Renders the dashboard home with operational KPIs, workload, and recent activity.
What calls it: `src/app/page.tsx`.
What it calls: `useDashboardData`, shared UI primitives, and route links.
What a junior would likely get wrong: Collapsing everything into a single large card and losing the operational hierarchy.
*/
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Box, FileSearch, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useDashboardData } from "@/hooks/use-dashboard-data";

const quickLinks = [
  { href: "/vendors", label: "Review vendors", icon: Box },
  { href: "/sourcing", label: "Compare quotes", icon: FileSearch },
  { href: "/purchase-orders", label: "Approve orders", icon: Truck },
  { href: "/reports", label: "Export reports", icon: ShieldAlert },
];

export function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useDashboardData();

  if (isLoading && !data) {
    return (
      <Card className="p-8">
        <p className="text-sm text-slate-300">Loading operational summary...</p>
      </Card>
    );
  }

  const dashboard = data ?? { summary: [], workload: [], activity: [] };

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[32px] p-7 lg:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/75">Daily command center</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white lg:text-5xl">
              Manage procurement flow and analytics from one control surface.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Track supplier performance, advance purchase approvals, inspect receiving
              discrepancies, and launch scheduled exports without leaving the workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" className="bg-white/5" onClick={() => router.refresh()}>
              Refresh summary
            </Button>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/25 transition hover:bg-sky-300"
            >
              Open analytics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.summary.map((item) => (
          <Card key={item.title} className="p-5">
            <CardEyebrow>{item.title}</CardEyebrow>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-sm text-slate-400">{item.delta}</p>
              </div>
              <Badge tone={item.tone}>{item.delta}</Badge>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Workload</CardEyebrow>
              <CardTitle>Operational queue coverage</CardTitle>
            </div>
            <Badge tone="sky">Tenant scoped</Badge>
          </CardHeader>
          <CardBody>
            {dashboard.workload.map((item) => {
              const percent = item.total === 0 ? 0 : Math.round((item.done / item.total) * 100);

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-200">{item.label}</span>
                    <span className="text-slate-400">
                      {item.done} / {item.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Actions</CardEyebrow>
              <CardTitle>Jump back into the workflow</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-white">
                    <Icon className="h-4 w-4 text-sky-200" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              );
            })}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Risk watch</CardEyebrow>
              <CardTitle>Items needing attention</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                4 receipts are late against approved POs and should be reconciled before month-end close.
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                One vendor is on hold, which means new RFQs should not be awarded without an override.
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Activity</CardEyebrow>
              <CardTitle>Latest changes</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            {dashboard.activity.length === 0 ? (
              <EmptyState
                title="No recent events"
                description="The activity stream will show approvals, receipts, and export jobs as the backend comes online."
                actionLabel="Go to reports"
                onAction={() => window.location.assign("/reports")}
              />
            ) : (
              dashboard.activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4">
                  <Badge tone={item.tone}>{item.time}</Badge>
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.detail}</p>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>

      {/* ⚠️ SENIOR NOTE: The dashboard uses query fallback data when `/api/dashboard` is missing. That keeps the UI working now, but if the fallback were ever treated as real data in production it would hide backend outages. */}
    </div>
  );
}
