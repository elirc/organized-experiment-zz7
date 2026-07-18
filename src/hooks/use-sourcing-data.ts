/*
What this file does: Loads RFQs, quote comparisons, and sourcing workflow status for the sourcing page.
What calls it: `src/components/sourcing/sourcing-page.tsx`.
What it calls: React Query and `/api/rfqs`.
What a junior would likely get wrong: Mixing RFQ state with quote state in the component instead of keeping the sourcing model centralized.
*/
"use client";

import { useQuery } from "@tanstack/react-query";

export type RfqStatus = "DRAFT" | "OPEN" | "AWARDED" | "CLOSED";

export type RfqRow = {
  id: string;
  title: string;
  status: RfqStatus;
  owner: string;
  dueDate: string;
  quotes: number;
  shortlisted: number;
};

export type QuoteComparison = {
  vendor: string;
  amount: string;
  leadTime: string;
  warranty: string;
  selected?: boolean;
};

const fallbackRfqs: RfqRow[] = [
  {
    id: "rfq-201",
    title: "Warehouse shelving refresh",
    status: "OPEN",
    owner: "Maya Chen",
    dueDate: "2026-04-11",
    quotes: 3,
    shortlisted: 2,
  },
  {
    id: "rfq-202",
    title: "Regional transport contract",
    status: "AWARDED",
    owner: "Jordan Lee",
    dueDate: "2026-04-02",
    quotes: 5,
    shortlisted: 1,
  },
  {
    id: "rfq-203",
    title: "Safety glove annual supply",
    status: "DRAFT",
    owner: "Maya Chen",
    dueDate: "2026-04-15",
    quotes: 0,
    shortlisted: 0,
  },
];

const fallbackComparisons: QuoteComparison[] = [
  { vendor: "Delta Parts", amount: "$128,400", leadTime: "4 weeks", warranty: "12 months", selected: true },
  { vendor: "North Coast Metals", amount: "$131,900", leadTime: "3 weeks", warranty: "9 months" },
  { vendor: "Apex Industrial", amount: "$129,800", leadTime: "5 weeks", warranty: "18 months" },
];

async function loadSourcingData(): Promise<{ rfqs: RfqRow[]; comparisons: QuoteComparison[] }> {
  try {
    const response = await fetch("/api/rfqs", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`RFQs endpoint returned ${response.status}`);
    }

    return (await response.json()) as { rfqs: RfqRow[]; comparisons: QuoteComparison[] };
  } catch {
    return { rfqs: fallbackRfqs, comparisons: fallbackComparisons };
  }
}

export function useSourcingData() {
  return useQuery({
    queryKey: ["sourcing"],
    queryFn: loadSourcingData,
  });
}

// ⚠️ SENIOR NOTE: RFQ and comparison fallback data is helpful for UI work, but the real source of truth must come from the same tenant-scoped backend query that powers approvals.
