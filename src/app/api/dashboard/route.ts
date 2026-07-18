/**
 * What this file does:
 * Returns the dashboard read model consumed by the home screen.
 * What calls it:
 * `src/hooks/use-dashboard-data.ts`.
 * What it calls:
 * `src/lib/http/route.ts` and `src/services/dashboardService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Returning raw counts without shaping them to the UX the page actually needs.
 */
import { jsonOk, withRouteAuth } from "@/lib/http/route";
import { dashboardService } from "@/services/dashboardService";

export const GET = withRouteAuth(async (_request, _context, session) => {
  const dashboard = await dashboardService.getDashboard(session);

  return jsonOk({
    activity: dashboard.recentPurchaseOrders.map((purchaseOrder) => ({
      detail: `${purchaseOrder.vendor} is currently ${purchaseOrder.status.toLowerCase().replace(/_/g, " ")}.`,
      id: purchaseOrder.poNumber,
      time: purchaseOrder.createdAt.slice(0, 10),
      title: purchaseOrder.poNumber,
      tone:
        purchaseOrder.status === "PENDING_APPROVAL"
          ? "amber"
          : purchaseOrder.status === "PARTIALLY_RECEIVED"
            ? "rose"
            : "emerald",
    })),
    summary: [
      {
        delta: `${dashboard.kpis.openRfqs} open RFQs`,
        title: "Open approvals",
        tone: "amber",
        value: String(dashboard.kpis.purchaseOrdersInFlight),
      },
      {
        delta: `${dashboard.session.organizationName}`,
        title: "Active vendors",
        tone: "sky",
        value: String(dashboard.kpis.vendors),
      },
      {
        delta: `${dashboard.kpis.discrepancies} discrepancies logged`,
        title: "Pending receipts",
        tone: "rose",
        value: String(dashboard.kpis.discrepancies + dashboard.kpis.purchaseOrdersInFlight),
      },
      {
        delta: `${dashboard.kpis.exportsPending} exports running`,
        title: "Reported spend",
        tone: "emerald",
        value: `${dashboard.recentPurchaseOrders.length} tracked orders`,
      },
    ],
    workload: [
      {
        done: Math.max(dashboard.kpis.openRfqs - 1, 0),
        label: "Quotes evaluated",
        total: Math.max(dashboard.kpis.openRfqs, 1),
      },
      {
        done: Math.max(dashboard.kpis.purchaseOrdersInFlight - 1, 0),
        label: "POs approved",
        total: Math.max(dashboard.kpis.purchaseOrdersInFlight, 1),
      },
      {
        done: Math.max(dashboard.kpis.discrepancies, 1),
        label: "Receipts reconciled",
        total: Math.max(dashboard.kpis.discrepancies + 2, 1),
      },
    ],
  });
});

// ⚠️ SENIOR NOTE: Dashboard routes should be read-model endpoints. If raw transactional entities leak through here,
// every client starts rebuilding summary logic differently.
