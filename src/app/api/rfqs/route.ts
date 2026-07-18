/**
 * What this file does:
 * Lists RFQs and creates new RFQs.
 * What calls it:
 * `src/hooks/use-sourcing-data.ts` and future RFQ create flows.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/rfqSchemas.ts`, and `src/services/sourcingService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Returning only RFQs and forcing the UI to reconstruct quote-comparison context from multiple calls.
 */
import { addDays } from "date-fns";

import { jsonOk, parseJsonBody, withRouteAuth } from "@/lib/http/route";
import { rfqCreateSchema } from "@/lib/validation";
import { sourcingService } from "@/services/sourcingService";

export const GET = withRouteAuth(
  async (_request, _context, session) => {
    const rfqs = await sourcingService.listRfqs(session);
    const firstRfqWithQuotes = rfqs.find((rfq) => rfq.quotes.length > 0);

    return jsonOk({
      comparisons:
        firstRfqWithQuotes?.quotes.map((quote) => ({
          amount: `$${quote.totalAmount.toLocaleString()}`,
          leadTime: quote.status === "SELECTED" ? "Preferred" : "Standard",
          selected: quote.status === "SELECTED",
          vendor: quote.vendor,
          warranty: quote.status === "SELECTED" ? "12 months" : "9 months",
        })) ?? [],
      rfqs: rfqs.map((rfq) => ({
        dueDate: addDays(new Date(rfq.createdAt), 7).toISOString().slice(0, 10),
        id: rfq.id,
        owner: rfq.createdBy ?? "Unknown",
        quotes: rfq.quotes.length,
        shortlisted: rfq.quotes.filter((quote) => quote.status === "SELECTED").length,
        status: rfq.status,
        title: rfq.title,
      })),
    });
  },
  { permission: "rfq.read" },
);

export const POST = withRouteAuth(
  async (request, _context, session) => {
    const input = await parseJsonBody(request, rfqCreateSchema);
    const rfq = await sourcingService.createRfq(session, input);
    return jsonOk(rfq, { status: 201 });
  },
  { permission: "rfq.write" },
);

// ⚠️ SENIOR NOTE: Combined list/read models like this should stay cheap and tenant-scoped; once they grow expensive,
// they should move to a dedicated read-model service rather than reintroducing client-side joins.
