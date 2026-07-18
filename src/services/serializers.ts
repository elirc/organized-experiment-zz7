function toNumber(value: unknown) {
  return Number(value);
}

export function serializeVendor(vendor: {
  id: string;
  name: string;
  code: string;
  status: string;
  paymentTerms: string;
  country: string;
  contactEmail: string;
  createdAt: Date;
}) {
  return {
    code: vendor.code,
    contactEmail: vendor.contactEmail,
    country: vendor.country,
    createdAt: vendor.createdAt.toISOString(),
    id: vendor.id,
    name: vendor.name,
    paymentTerms: vendor.paymentTerms,
    status: vendor.status,
  };
}

export function serializeRfq(rfq: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
  createdBy?: { name: string } | null;
  lineItems: Array<{ id: string; description: string; quantity: number; targetUnitPrice: unknown }>;
  quotes?: Array<{
    id: string;
    status: string;
    currency: string;
    totalAmount: unknown;
    vendor: { name: string };
    lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: unknown }>;
  }>;
}) {
  return {
    createdAt: rfq.createdAt.toISOString(),
    createdBy: rfq.createdBy?.name ?? null,
    description: rfq.description,
    id: rfq.id,
    lineItems: rfq.lineItems.map((lineItem) => ({
      description: lineItem.description,
      id: lineItem.id,
      quantity: lineItem.quantity,
      targetUnitPrice: lineItem.targetUnitPrice ? toNumber(lineItem.targetUnitPrice) : null,
    })),
    quotes:
      rfq.quotes?.map((quote) => ({
        currency: quote.currency,
        id: quote.id,
        lineItems: quote.lineItems.map((lineItem) => ({
          description: lineItem.description,
          id: lineItem.id,
          quantity: lineItem.quantity,
          unitPrice: toNumber(lineItem.unitPrice),
        })),
        status: quote.status,
        totalAmount: toNumber(quote.totalAmount),
        vendor: quote.vendor.name,
      })) ?? [],
    status: rfq.status,
    title: rfq.title,
  };
}

export function serializePurchaseOrder(purchaseOrder: {
  id: string;
  poNumber: string;
  status: string;
  currency: string;
  totalAmount: unknown;
  createdAt?: Date;
  approvedAt?: Date | null;
  receivedAt?: Date | null;
  vendor: { name: string };
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: unknown }>;
  receipts?: Array<{
    id: string;
    receivedAt: Date;
    status: string;
    lineItems: Array<{ id: string; purchaseOrderLineItemId: string; quantityReceived: number }>;
    discrepancies: Array<{ id: string; type: string; description: string }>;
  }>;
}) {
  return {
    approvedAt: purchaseOrder.approvedAt?.toISOString() ?? null,
    createdAt: purchaseOrder.createdAt?.toISOString() ?? null,
    currency: purchaseOrder.currency,
    id: purchaseOrder.id,
    lineItems: purchaseOrder.lineItems.map((lineItem) => ({
      description: lineItem.description,
      id: lineItem.id,
      quantity: lineItem.quantity,
      unitPrice: toNumber(lineItem.unitPrice),
    })),
    poNumber: purchaseOrder.poNumber,
    receipts:
      purchaseOrder.receipts?.map((receipt) => ({
        discrepancies: receipt.discrepancies.map((discrepancy) => ({
          description: discrepancy.description,
          id: discrepancy.id,
          type: discrepancy.type,
        })),
        id: receipt.id,
        lineItems: receipt.lineItems.map((lineItem) => ({
          id: lineItem.id,
          purchaseOrderLineItemId: lineItem.purchaseOrderLineItemId,
          quantityReceived: lineItem.quantityReceived,
        })),
        receivedAt: receipt.receivedAt.toISOString(),
        status: receipt.status,
      })) ?? [],
    receivedAt: purchaseOrder.receivedAt?.toISOString() ?? null,
    status: purchaseOrder.status,
    totalAmount: toNumber(purchaseOrder.totalAmount),
    vendor: purchaseOrder.vendor.name,
  };
}

export function serializeReportDefinition(reportDefinition: {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  dimensions: string[];
  metrics: string[];
  filters: unknown;
  createdAt: Date;
  createdBy: { name: string };
}) {
  return {
    createdAt: reportDefinition.createdAt.toISOString(),
    createdBy: reportDefinition.createdBy.name,
    description: reportDefinition.description,
    dimensions: reportDefinition.dimensions,
    filters: reportDefinition.filters,
    id: reportDefinition.id,
    metrics: reportDefinition.metrics,
    name: reportDefinition.name,
    reportType: reportDefinition.reportType,
  };
}

export function serializeExportJob(exportJob: {
  id: string;
  status: string;
  format: string;
  requestedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  fileName?: string | null;
  rowCount?: number | null;
  errorMessage?: string | null;
  reportDefinition: { name: string };
  requestedBy: { name: string };
}) {
  return {
    completedAt: exportJob.completedAt?.toISOString() ?? null,
    errorMessage: exportJob.errorMessage ?? null,
    fileName: exportJob.fileName ?? null,
    format: exportJob.format,
    id: exportJob.id,
    reportName: exportJob.reportDefinition.name,
    requestedAt: exportJob.requestedAt.toISOString(),
    requestedBy: exportJob.requestedBy.name,
    rowCount: exportJob.rowCount ?? null,
    startedAt: exportJob.startedAt?.toISOString() ?? null,
    status: exportJob.status,
  };
}
