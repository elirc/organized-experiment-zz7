/**
 * What this file does:
 * Provides tenant-scoped dashboard read models for the home page.
 * What calls it:
 * `src/app/api/dashboard/route.ts`.
 * What it calls:
 * `src/repositories/dashboardRepository.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Returning raw Prisma records directly and leaving the UI to understand domain semantics.
 */
import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { dashboardRepository } from "@/repositories/dashboardRepository";

export const dashboardService = {
  async getDashboard(session: AuthenticatedSession) {
    const summary = await dashboardRepository.getSummary(session.tenantId);

    return {
      kpis: {
        discrepancies: summary.discrepancies,
        exportsPending: summary.exportsPending,
        openRfqs: summary.rfqsOpen,
        purchaseOrdersInFlight: summary.purchaseOrders,
        vendors: summary.vendors,
      },
      recentPurchaseOrders: summary.recentPurchaseOrders.map((purchaseOrder) => ({
        createdAt: purchaseOrder.createdAt.toISOString(),
        poNumber: purchaseOrder.poNumber,
        status: purchaseOrder.status,
        totalAmount: Number(purchaseOrder.totalAmount),
        vendor: purchaseOrder.vendor.name,
      })),
      session: {
        membershipRole: session.membershipRole,
        organizationName: session.organizationName,
        userName: session.name,
      },
    };
  },
};

// ⚠️ SENIOR NOTE: Dashboard services should expose UI-ready read models; otherwise every component rebuilds the same
// business framing and eventually diverges.
