/*
What this file does: Loads the dashboard summary and activity feed for the app home.
What calls it: `src/components/dashboard/dashboard-page.tsx`.
What it calls: React Query and the `/api/dashboard` endpoint when the backend is ready.
What a junior would likely get wrong: Hardcoding the dashboard numbers in the page component instead of keeping the data boundary in a hook.
*/
"use client";

import { useQuery } from "@tanstack/react-query";

export type DashboardSummary = {
  title: string;
  value: string;
  delta: string;
  tone: "sky" | "emerald" | "amber" | "rose";
};

export type DashboardActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "sky" | "emerald" | "amber" | "rose";
};

export type DashboardWorkload = {
  label: string;
  total: number;
  done: number;
};

export type DashboardData = {
  summary: DashboardSummary[];
  workload: DashboardWorkload[];
  activity: DashboardActivity[];
};

const fallbackDashboard: DashboardData = {
  summary: [
    { title: "Open approvals", value: "12", delta: "+3 this week", tone: "amber" },
    { title: "Active vendors", value: "84", delta: "+6 this month", tone: "sky" },
    { title: "Pending receipts", value: "19", delta: "4 late", tone: "rose" },
    { title: "Reported spend", value: "$4.2M", delta: "+8.4% YoY", tone: "emerald" },
  ],
  workload: [
    { label: "Quotes evaluated", total: 18, done: 14 },
    { label: "POs approved", total: 26, done: 22 },
    { label: "Receipts reconciled", total: 11, done: 7 },
  ],
  activity: [
    {
      id: "a1",
      title: "PO-1048 approved",
      detail: "Facilities equipment order moved to ready-for-receipt.",
      time: "12 min ago",
      tone: "emerald",
    },
    {
      id: "a2",
      title: "RFQ response received",
      detail: "Delta Parts uploaded a quote with revised lead time.",
      time: "38 min ago",
      tone: "sky",
    },
    {
      id: "a3",
      title: "Receiving discrepancy logged",
      detail: "Two line items arrived short on the warehouse dock.",
      time: "2 hr ago",
      tone: "rose",
    },
  ],
};

async function loadDashboardData(): Promise<DashboardData> {
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Dashboard endpoint returned ${response.status}`);
    }

    return (await response.json()) as DashboardData;
  } catch {
    return fallbackDashboard;
  }
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: loadDashboardData,
  });
}

// ⚠️ SENIOR NOTE: The fallback data keeps the shell demoable, but it would mask a broken `/api/dashboard` response if someone forgot to remove the fallback in production.
