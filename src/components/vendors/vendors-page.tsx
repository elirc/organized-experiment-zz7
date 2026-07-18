/*
What this file does: Renders the vendor directory and lightweight operational filters.
What calls it: `src/app/(app)/vendors/page.tsx`.
What it calls: `useVendorsData` and shared UI primitives.
What a junior would likely get wrong: Making the vendor list a static table without status filtering or contact detail cues.
*/
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useVendorsData, type VendorStatus } from "@/hooks/use-vendors-data";

const statusOptions: Array<VendorStatus | "ALL"> = ["ALL", "ACTIVE", "ON_HOLD", "INACTIVE"];

function statusTone(status: VendorStatus) {
  if (status === "ACTIVE") return "emerald";
  if (status === "ON_HOLD") return "amber";
  return "rose";
}

export function VendorsPage() {
  const { data = [] } = useVendorsData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("ALL");

  const visible = data.filter((vendor) => {
    const matchesQuery =
      query.trim().length === 0 ||
      [vendor.name, vendor.code, vendor.contactEmail, vendor.country]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesStatus = status === "ALL" || vendor.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader>
          <div>
            <CardEyebrow>Vendor directory</CardEyebrow>
            <CardTitle>Supplier relationships and hold status</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-slate-400">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vendor, code, email, country"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/40"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-slate-400">Status</span>
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
            {visible.length} vendors visible
          </div>
        </CardBody>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title="No vendors match the current filter"
          description="This shell is wired for tenant-scoped directory data, so the real backend will decide which vendors belong in this list."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((vendor) => (
            <Card key={vendor.id} className="p-6">
              <CardHeader>
                <div>
                  <CardEyebrow>{vendor.code}</CardEyebrow>
                  <CardTitle>{vendor.name}</CardTitle>
                </div>
                <Badge tone={statusTone(vendor.status)}>{vendor.status}</Badge>
              </CardHeader>
              <CardBody className="space-y-3 text-sm text-slate-300">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Terms</p>
                    <p className="mt-1 text-white">{vendor.paymentTerms}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Country</p>
                    <p className="mt-1 text-white">{vendor.country}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Contact</p>
                    <p className="mt-1 text-white">{vendor.contactEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Last order</p>
                    <p className="mt-1 text-white">{vendor.lastOrder}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-slate-400">Performance rating</span>
                  <Badge tone="sky">{vendor.rating}</Badge>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* ⚠️ SENIOR NOTE: Vendor visibility should stay tenant-scoped in the backend. If a future API forgot to filter by organization, this exact page would happily render cross-organization suppliers. */}
    </div>
  );
}
