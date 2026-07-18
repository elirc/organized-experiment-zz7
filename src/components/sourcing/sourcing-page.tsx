/*
What this file does: Renders the RFQ work queue and quote comparison view for sourcing workflows.
What calls it: `src/app/(app)/sourcing/page.tsx`.
What it calls: `useSourcingData` and shared UI primitives.
What a junior would likely get wrong: Flattening RFQs and quotes into one list and obscuring the award decision.
*/
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSourcingData, type RfqStatus } from "@/hooks/use-sourcing-data";

const statusOptions: Array<RfqStatus | "ALL"> = ["ALL", "DRAFT", "OPEN", "AWARDED", "CLOSED"];

function toneForRfq(status: RfqStatus) {
  if (status === "OPEN") return "sky";
  if (status === "AWARDED") return "emerald";
  if (status === "DRAFT") return "slate";
  return "amber";
}

export function SourcingPage() {
  const { data } = useSourcingData();
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("ALL");

  const rfqs = data?.rfqs ?? [];
  const comparisons = data?.comparisons ?? [];
  const visibleRfqs = rfqs.filter((rfq) => status === "ALL" || rfq.status === status);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader>
          <div>
            <CardEyebrow>RFQ board</CardEyebrow>
            <CardTitle>Sourcing status and award readiness</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <label className="inline-flex flex-col">
            <span className="mb-2 text-xs uppercase tracking-[0.28em] text-slate-400">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
            >
              {statusOptions.map((item) => (
                <option key={item} value={item} className="bg-slate-950">
                  {item}
                </option>
              ))}
            </select>
          </label>
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Queue</CardEyebrow>
              <CardTitle>Active RFQs</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {visibleRfqs.length === 0 ? (
              <EmptyState
                title="No RFQs match the filter"
                description="The RFQ queue will stay aligned with backend state transitions, so drafts cannot silently behave like awards."
              />
            ) : (
              visibleRfqs.map((rfq) => (
                <div
                  key={rfq.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{rfq.title}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Owner: {rfq.owner} - Due {rfq.dueDate}
                      </p>
                    </div>
                    <Badge tone={toneForRfq(rfq.status)}>{rfq.status}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Quotes</p>
                      <p className="mt-1 text-white">{rfq.quotes}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Shortlisted</p>
                      <p className="mt-1 text-white">{rfq.shortlisted}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">State</p>
                      <p className="mt-1 text-white">{rfq.status}</p>
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
              <CardEyebrow>Comparison</CardEyebrow>
              <CardTitle>Vendor quote shortlist</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {comparisons.map((quote) => (
              <div
                key={quote.vendor}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{quote.vendor}</p>
                  {quote.selected ? <Badge tone="emerald">Selected</Badge> : <Badge tone="slate">Bench</Badge>}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Amount</p>
                    <p className="mt-1 text-white">{quote.amount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Lead time</p>
                    <p className="mt-1 text-white">{quote.leadTime}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Warranty</p>
                    <p className="mt-1 text-white">{quote.warranty}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* ⚠️ SENIOR NOTE: RFQ award logic must stay in the service layer later, not in this page. If the UI started deciding the winner locally, approval and audit trails would drift apart from the backend record. */}
    </div>
  );
}
