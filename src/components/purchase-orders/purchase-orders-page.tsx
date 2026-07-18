/*
What this file does: Renders purchase order approval and receiving worklists.
What calls it: `src/app/(app)/purchase-orders/page.tsx`.
What it calls: `usePurchaseOrdersData` and shared UI primitives.
What a junior would likely get wrong: Letting draft and approved orders look identical and hiding the state transition from the operator.
*/
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { usePurchaseOrdersData, type PurchaseOrderStatus } from "@/hooks/use-purchase-orders-data";

const statusOptions: Array<PurchaseOrderStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
];

function toneForStatus(status: PurchaseOrderStatus) {
  if (status === "APPROVED" || status === "RECEIVED") return "emerald";
  if (status === "PENDING_APPROVAL" || status === "PARTIALLY_RECEIVED") return "amber";
  if (status === "CANCELLED") return "rose";
  return "sky";
}

export function PurchaseOrdersPage() {
  const { data = [] } = usePurchaseOrdersData();
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("ALL");

  const visible = data.filter((po) => status === "ALL" || po.status === status);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader>
          <div>
            <CardEyebrow>Purchase orders</CardEyebrow>
            <CardTitle>Approval queue and receiving status</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col">
            <span className="mb-2 text-xs uppercase tracking-[0.28em] text-slate-400">Status</span>
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
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            {visible.length} purchase orders visible
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardEyebrow>Queue</CardEyebrow>
              <CardTitle>Operational PO list</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {visible.length === 0 ? (
              <EmptyState
                title="No purchase orders in view"
                description="The backend will own state transitions, but the shell is already set up to show approval and receiving stages separately."
              />
            ) : (
              visible.map((po) => (
                <div key={po.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{po.poNumber}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Vendor: {po.vendor} - Requested by {po.requester}
                      </p>
                    </div>
                    <Badge tone={toneForStatus(po.status)}>{po.status}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Amount</p>
                      <p className="mt-1 text-white">{po.amount}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Approver</p>
                      <p className="mt-1 text-white">{po.approver}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">ETA</p>
                      <p className="mt-1 text-white">{po.eta}</p>
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
              <CardEyebrow>Workflow</CardEyebrow>
              <CardTitle>State transition snapshot</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Draft to Pending approval to Approved to Partially received to Received to Closed
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-50">
              This page only renders the state path. The transition guard belongs in the backend service so a
              buyer cannot approve a closed PO or receive against a cancelled one.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Discrepancies stay visible after receiving so finance can reconcile shortages, over-deliveries, and
              damaged items before close.
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ⚠️ SENIOR NOTE: The current UI only displays PO state. The backend must enforce the valid transition graph, or the client could show a path that never actually happened. */}
    </div>
  );
}
