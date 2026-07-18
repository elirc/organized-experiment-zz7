/**
 * What this file does:
 * Accepts quote submissions for a specific RFQ.
 * What calls it:
 * Future sourcing quote-submission flows.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/rfqSchemas.ts`, and `src/services/sourcingService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Trusting the RFQ ID from the body instead of the route parameter.
 */
import { jsonOk, withRouteAuth, type RouteContext } from "@/lib/http/route";
import { quoteSubmitSchema } from "@/lib/validation";
import { sourcingService } from "@/services/sourcingService";

export const POST = withRouteAuth(
  async (
    request,
    context: RouteContext<{ rfqId: string }>,
    session,
  ) => {
    const { rfqId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = quoteSubmitSchema.parse({
      ...body,
      rfqId,
      submittedById: session.userId,
      totalAmount: 0,
    });
    const quote = await sourcingService.createQuote(session, rfqId, {
      currency: input.currency,
      lineItems: input.lineItems,
      validUntil: input.validUntil,
      vendorId: input.vendorId,
    });

    return jsonOk(quote, { status: 201 });
  },
  { permission: "rfq.write" },
);

// ⚠️ SENIOR NOTE: Route params should beat body IDs for parent-child resources; otherwise a client can submit a quote to
// one URL while targeting a different RFQ in the payload.
