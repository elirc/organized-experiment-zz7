/**
 * What this file does:
 * Provides read models for dashboard widgets and analytics export datasets.
 * What calls it:
 * `src/services/dashboardService.ts` and `src/services/exportJobService.ts`.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Reusing transactional repository shapes for reporting, which forces UI code to aggregate raw rows itself.
 */
import { PurchaseOrderStatus, ReportType } from "@prisma/client";

import { prisma } from "@/lib/prisma/client";

type ReportFilterInput = {
  dateFrom?: Date;
  dateTo?: Date;
  vendorIds?: string[];
  purchaseOrderStatuses?: string[];
  currencies?: string[];
  minAmount?: number;
};

function applyFilters<
  T extends Record<string, string | number | null | undefined | string[]>,
>(
  rows: T[],
  filters: ReportFilterInput,
) {
  return rows.filter((row) => {
    if (filters.vendorIds?.length && row.vendorId && !filters.vendorIds.includes(String(row.vendorId))) {
      return false;
    }

    if (
      filters.purchaseOrderStatuses?.length &&
      row.status &&
      !filters.purchaseOrderStatuses.includes(String(row.status))
    ) {
      return false;
    }

    if (filters.currencies?.length && row.currency && !filters.currencies.includes(String(row.currency))) {
      return false;
    }

    if (
      typeof filters.minAmount === "number" &&
      typeof row.totalAmount === "number" &&
      row.totalAmount < filters.minAmount
    ) {
      return false;
    }

    if (filters.dateFrom && row.dateValue && new Date(String(row.dateValue)) < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && row.dateValue && new Date(String(row.dateValue)) > filters.dateTo) {
      return false;
    }

    return true;
  });
}

export const dashboardRepository = {
  async getSummary(tenantId: string) {
    const [vendors, rfqsOpen, purchaseOrders, discrepancies, exportsPending] =
      await Promise.all([
        prisma.vendor.count({
          where: {
            tenantId,
          },
        }),
        prisma.requestForQuote.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "DRAFT"] },
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            tenantId,
            status: {
              in: [
                PurchaseOrderStatus.PENDING_APPROVAL,
                PurchaseOrderStatus.APPROVED,
                PurchaseOrderStatus.PARTIALLY_RECEIVED,
              ],
            },
          },
        }),
        prisma.discrepancy.count({
          where: {
            tenantId,
          },
        }),
        prisma.exportJob.count({
          where: {
            tenantId,
            status: { in: ["PENDING", "RUNNING"] },
          },
        }),
      ]);

    const recentPurchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
      },
      include: {
        vendor: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    });

    return {
      discrepancies,
      exportsPending,
      purchaseOrders,
      recentPurchaseOrders,
      rfqsOpen,
      vendors,
    };
  },

  async buildRowsForReport(
    tenantId: string,
    input: { reportType: ReportType; filters: ReportFilterInput },
  ) {
    if (input.reportType === ReportType.PROCUREMENT_SPEND) {
      const orders = await prisma.purchaseOrder.findMany({
        where: {
          tenantId,
          status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] },
        },
        include: {
          vendor: true,
        },
      });

      const rows = orders.map((order) => ({
        currency: order.currency,
        dateValue: order.createdAt.toISOString(),
        poNumber: order.poNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        vendorId: order.vendorId,
        vendor: order.vendor.name,
      }));

      return applyFilters(rows, input.filters);
    }

    if (input.reportType === ReportType.VENDOR_PERFORMANCE) {
      const quotes = await prisma.quote.findMany({
        where: {
          tenantId,
        },
        include: {
          vendor: true,
        },
      });

      const grouped = new Map<
        string,
        { vendor: string; quoteCount: number; submittedValue: number }
      >();

      for (const quote of quotes) {
        const current = grouped.get(quote.vendorId) ?? {
          quoteCount: 0,
          submittedValue: 0,
          vendorId: quote.vendorId,
          vendor: quote.vendor.name,
        };

        current.quoteCount += 1;
        current.submittedValue += Number(quote.totalAmount);
        grouped.set(quote.vendorId, current);
      }

      return applyFilters(Array.from(grouped.values()), input.filters);
    }

    if (input.reportType === ReportType.RECEIVING_DISCREPANCY) {
      const discrepancies = await prisma.discrepancy.findMany({
        where: {
          tenantId,
        },
        include: {
          purchaseOrderLineItem: {
            include: {
              purchaseOrder: true,
            },
          },
          receipt: true,
        },
      });

      const rows = discrepancies.map((discrepancy) => ({
        dateValue: discrepancy.receipt.receivedAt.toISOString(),
        description: discrepancy.description,
        poNumber: discrepancy.purchaseOrderLineItem.purchaseOrder.poNumber,
        receivedAt: discrepancy.receipt.receivedAt.toISOString().slice(0, 10),
        type: discrepancy.type,
      }));

      return applyFilters(rows, input.filters);
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
      },
      include: {
        vendor: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const rows = purchaseOrders.map((purchaseOrder) => ({
      currency: purchaseOrder.currency,
      dateValue: purchaseOrder.createdAt.toISOString(),
      poNumber: purchaseOrder.poNumber,
      status: purchaseOrder.status,
      totalAmount: Number(purchaseOrder.totalAmount),
      vendorId: purchaseOrder.vendorId,
      vendor: purchaseOrder.vendor.name,
    }));

    return applyFilters(rows, input.filters);
  },
};

// ⚠️ SENIOR NOTE: Reporting reads often start as "just fetch some rows," but if the UI has to perform the grouping and
// filtering itself, you lose one auditable place to reason about what the report actually means.
