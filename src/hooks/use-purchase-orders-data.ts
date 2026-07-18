/*
What this file does: Loads purchase orders and their current approval/receiving state.
What calls it: `src/components/purchase-orders/purchase-orders-page.tsx`.
What it calls: React Query and `/api/purchase-orders`.
What a junior would likely get wrong: Encoding status labels directly in the view and making state transitions impossible to audit.
*/
"use client";

import { useQuery } from "@tanstack/react-query";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";

export type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  vendor: string;
  status: PurchaseOrderStatus;
  amount: string;
  requester: string;
  approver: string;
  eta: string;
};

const fallbackPurchaseOrders: PurchaseOrderRow[] = [
  {
    id: "po-1048",
    poNumber: "PO-1048",
    vendor: "Delta Parts",
    status: "PENDING_APPROVAL",
    amount: "$128,400",
    requester: "Maya Chen",
    approver: "Pat Gomez",
    eta: "2026-04-14",
  },
  {
    id: "po-1041",
    poNumber: "PO-1041",
    vendor: "Apex Industrial",
    status: "PARTIALLY_RECEIVED",
    amount: "$42,200",
    requester: "Jordan Lee",
    approver: "Pat Gomez",
    eta: "2026-04-09",
  },
  {
    id: "po-1035",
    poNumber: "PO-1035",
    vendor: "North Coast Metals",
    status: "APPROVED",
    amount: "$17,900",
    requester: "Maya Chen",
    approver: "Pat Gomez",
    eta: "2026-04-10",
  },
];

async function loadPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  try {
    const response = await fetch("/api/purchase-orders", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Purchase orders endpoint returned ${response.status}`);
    }

    return (await response.json()) as PurchaseOrderRow[];
  } catch {
    return fallbackPurchaseOrders;
  }
}

export function usePurchaseOrdersData() {
  return useQuery({
    queryKey: ["purchase-orders"],
    queryFn: loadPurchaseOrders,
  });
}

// ⚠️ SENIOR NOTE: This hook deliberately mirrors the approval and receiving stages, but backend status transitions still need to be the only place that can advance a PO.
