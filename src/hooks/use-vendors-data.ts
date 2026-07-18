/*
What this file does: Loads the vendor directory and keeps vendor search/filter data out of components.
What calls it: `src/components/vendors/vendors-page.tsx`.
What it calls: React Query and `/api/vendors` when available.
What a junior would likely get wrong: Filtering vendors in a table component and making the view logic hard to test.
*/
"use client";

import { useQuery } from "@tanstack/react-query";

export type VendorStatus = "ACTIVE" | "ON_HOLD" | "INACTIVE";

export type VendorRow = {
  id: string;
  name: string;
  code: string;
  status: VendorStatus;
  paymentTerms: string;
  country: string;
  contactEmail: string;
  rating: string;
  lastOrder: string;
};

const fallbackVendors: VendorRow[] = [
  {
    id: "v1",
    name: "Delta Parts",
    code: "DELTA",
    status: "ACTIVE",
    paymentTerms: "Net 30",
    country: "US",
    contactEmail: "ap@deltaparts.com",
    rating: "A",
    lastOrder: "2 days ago",
  },
  {
    id: "v2",
    name: "North Coast Metals",
    code: "NCM",
    status: "ON_HOLD",
    paymentTerms: "Net 45",
    country: "CA",
    contactEmail: "quotes@northcoastmetals.ca",
    rating: "B",
    lastOrder: "12 days ago",
  },
  {
    id: "v3",
    name: "Apex Industrial",
    code: "APX",
    status: "ACTIVE",
    paymentTerms: "Net 60",
    country: "US",
    contactEmail: "sales@apexindustrial.com",
    rating: "A+",
    lastOrder: "4 hours ago",
  },
];

async function loadVendors(): Promise<VendorRow[]> {
  try {
    const response = await fetch("/api/vendors", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Vendors endpoint returned ${response.status}`);
    }

    return (await response.json()) as VendorRow[];
  } catch {
    return fallbackVendors;
  }
}

export function useVendorsData() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: loadVendors,
  });
}

// ⚠️ SENIOR NOTE: Returning fallback vendors is fine for a frontend shell, but the production query must preserve tenant filters or this page becomes a cross-organization leak.
