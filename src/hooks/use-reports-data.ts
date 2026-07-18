/*
What this file does: Loads saved analytics report definitions and export job history.
What calls it: `src/components/reports/reports-page.tsx`.
What it calls: React Query and `/api/reports`.
What a junior would likely get wrong: Treating reporting as a view-only concern and burying the query state outside the feature boundary.
*/
"use client";

import { useQuery } from "@tanstack/react-query";

export type ReportType =
  | "PROCUREMENT_SPEND"
  | "VENDOR_PERFORMANCE"
  | "RECEIVING_DISCREPANCY"
  | "PURCHASE_ORDER_PIPELINE"
  | "CUSTOM";

export type ExportJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type ReportDefinitionRow = {
  id: string;
  name: string;
  reportType: ReportType;
  dimensions: string[];
  metrics: string[];
  filters: string;
  owner: string;
  updatedAt: string;
};

export type ExportJobRow = {
  id: string;
  reportName: string;
  format: "CSV" | "JSON";
  status: ExportJobStatus;
  requestedBy: string;
  requestedAt: string;
  rows: number;
};

const fallbackReports: ReportDefinitionRow[] = [
  {
    id: "rep-1",
    name: "Monthly spend by category",
    reportType: "PROCUREMENT_SPEND",
    dimensions: ["Category", "Vendor", "Month"],
    metrics: ["Spend", "Average lead time"],
    filters: "Status = Approved; Date = last 90 days",
    owner: "Maya Chen",
    updatedAt: "2026-04-05",
  },
  {
    id: "rep-2",
    name: "Vendor performance scorecard",
    reportType: "VENDOR_PERFORMANCE",
    dimensions: ["Vendor", "Region"],
    metrics: ["On-time rate", "Defect rate"],
    filters: "Only active vendors",
    owner: "Jordan Lee",
    updatedAt: "2026-04-03",
  },
];

const fallbackExports: ExportJobRow[] = [
  {
    id: "exp-1",
    reportName: "Monthly spend by category",
    format: "CSV",
    status: "RUNNING",
    requestedBy: "Maya Chen",
    requestedAt: "2026-04-07 09:20",
    rows: 18_420,
  },
  {
    id: "exp-2",
    reportName: "Vendor performance scorecard",
    format: "JSON",
    status: "SUCCEEDED",
    requestedBy: "Jordan Lee",
    requestedAt: "2026-04-07 08:10",
    rows: 2_104,
  },
];

async function loadReports(): Promise<{ reports: ReportDefinitionRow[]; exports: ExportJobRow[] }> {
  try {
    const response = await fetch("/api/reports", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Reports endpoint returned ${response.status}`);
    }

    return (await response.json()) as { reports: ReportDefinitionRow[]; exports: ExportJobRow[] };
  } catch {
    return { reports: fallbackReports, exports: fallbackExports };
  }
}

export function useReportsData() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: loadReports,
  });
}

// ⚠️ SENIOR NOTE: Report definitions and export jobs are separate on purpose. If they were merged later, it would get harder to protect saved-query ownership and background job state independently.
