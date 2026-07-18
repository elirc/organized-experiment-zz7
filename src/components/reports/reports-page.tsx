/*
What this file does: Renders the report builder, saved report list, and export job queue.
What calls it: `src/app/(app)/reports/page.tsx`.
What it calls: `useReportsData` and shared UI primitives.
What a junior would likely get wrong: Treating reporting as a read-only table and burying the filter/dimension/metric choices.
*/
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useReportsData, type ReportType } from "@/hooks/use-reports-data";

const reportTypes: ReportType[] = [
  "PROCUREMENT_SPEND",
  "VENDOR_PERFORMANCE",
  "RECEIVING_DISCREPANCY",
  "PURCHASE_ORDER_PIPELINE",
  "CUSTOM",
];

const dimensionOptions = ["Category", "Vendor", "Month", "Region", "Requester", "Status"];
const metricOptions = ["Spend", "Average lead time", "On-time rate", "Discount capture", "Rows"];
const filterOptions = ["Approved only", "Last 90 days", "Only active vendors", "Exclude cancelled", "In-progress jobs"];

function toneForJob(status: string) {
  if (status === "SUCCEEDED") return "emerald";
  if (status === "RUNNING" || status === "PENDING") return "amber";
  return "rose";
}

export function ReportsPage() {
  const { data } = useReportsData();
  const [selectedType, setSelectedType] = useState<ReportType>("PROCUREMENT_SPEND");
  const [dimensions, setDimensions] = useState<string[]>(["Category", "Month"]);
  const [metrics, setMetrics] = useState<string[]>(["Spend"]);
  const [filters, setFilters] = useState<string[]>(["Approved only"]);
  const [exportFormat, setExportFormat] = useState<"CSV" | "JSON">("CSV");

  const reports = data?.reports ?? [];
  const exports = data?.exports ?? [];

  function toggleValue(value: string, current: string[], setCurrent: (next: string[]) => void) {
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Report builder</CardEyebrow>
              <CardTitle>Configure a saved analytics query</CardTitle>
            </div>
            <Badge tone="sky">{selectedType}</Badge>
          </CardHeader>
          <CardBody className="space-y-5">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.28em] text-slate-400">Report type</label>
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value as ReportType)}
                className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
              >
                {reportTypes.map((item) => (
                  <option key={item} value={item} className="bg-slate-950">
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-400">Dimensions</p>
              <div className="flex flex-wrap gap-2">
                {dimensionOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleValue(item, dimensions, setDimensions)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      dimensions.includes(item)
                        ? "bg-sky-400 text-slate-950"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-400">Metrics</p>
              <div className="flex flex-wrap gap-2">
                {metricOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleValue(item, metrics, setMetrics)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      metrics.includes(item)
                        ? "bg-emerald-400 text-slate-950"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-slate-400">Filters</p>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleValue(item, filters, setFilters)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      filters.includes(item)
                        ? "bg-amber-400 text-slate-950"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Builder state is local for now. When the backend lands, the same controls can serialize to a saved
              report definition and dispatch an export job.
            </div>
          </CardBody>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Preview</CardEyebrow>
              <CardTitle>Current report snapshot</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Selected dimensions</p>
              <p className="mt-2 text-white">{dimensions.join(", ") || "None"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Selected metrics</p>
              <p className="mt-2 text-white">{metrics.join(", ") || "None"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Filters</p>
              <p className="mt-2 text-white">{filters.join(", ") || "None"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="sky">Format: {exportFormat}</Badge>
              <Button variant="secondary" onClick={() => setExportFormat(exportFormat === "CSV" ? "JSON" : "CSV")}>
                Toggle format
              </Button>
              <Button
                onClick={() => {
                  console.info("Queue export requested for", selectedType, dimensions, metrics, filters);
                }}
              >
                Queue export
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Saved reports</CardEyebrow>
              <CardTitle>Definitions owned by the organization</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {reports.length === 0 ? (
              <EmptyState
                title="No reports saved yet"
                description="The saved report list will store dimensions, metrics, filters, and permission-aware ownership once the API is wired."
              />
            ) : (
              reports.map((report) => (
                <div key={report.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{report.name}</p>
                      <p className="mt-1 text-sm text-slate-400">Owner: {report.owner}</p>
                    </div>
                    <Badge tone="sky">{report.reportType}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300">
                    <div>
                      <span className="text-slate-500">Dimensions: </span>
                      {report.dimensions.join(", ")}
                    </div>
                    <div>
                      <span className="text-slate-500">Metrics: </span>
                      {report.metrics.join(", ")}
                    </div>
                    <div>
                      <span className="text-slate-500">Filters: </span>
                      {report.filters}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Export jobs</CardEyebrow>
              <CardTitle>Async job queue</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {exports.length === 0 ? (
              <EmptyState
                title="No exports running"
                description="Background workers will eventually pick up export jobs and write files back to storage."
              />
            ) : (
              exports.map((job) => (
                <div key={job.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{job.reportName}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Requested by {job.requestedBy} at {job.requestedAt}
                      </p>
                    </div>
                    <Badge tone={toneForJob(job.status)}>{job.status}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Format</p>
                      <p className="mt-1 text-white">{job.format}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Rows</p>
                      <p className="mt-1 text-white">{job.rows.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* ⚠️ SENIOR NOTE: The builder state is client-side only in this slice. A real backend must persist the selected dimensions/metrics/filters and validate that the requested export belongs to the current tenant. */}
    </div>
  );
}
