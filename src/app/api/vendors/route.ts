/**
 * What this file does:
 * Lists and creates tenant-scoped vendors.
 * What calls it:
 * `src/hooks/use-vendors-data.ts` and future vendor create flows.
 * What it calls:
 * `src/lib/http/route.ts`, `src/lib/validation/vendorSchemas.ts`, and `src/services/vendorService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Letting the route own tenant scoping instead of pushing that responsibility into the service and repository layers.
 */
import { formatDistanceToNow } from "date-fns";

import { jsonOk, parseJsonBody, withRouteAuth } from "@/lib/http/route";
import { vendorCreateSchema } from "@/lib/validation";
import { vendorService } from "@/services/vendorService";

export const GET = withRouteAuth(
  async (_request, _context, session) => {
    const vendors = await vendorService.listVendors(session);

    return jsonOk(
      vendors.map((vendor) => ({
        ...vendor,
        lastOrder: formatDistanceToNow(new Date(vendor.createdAt), { addSuffix: true }),
        rating:
          vendor.status === "ACTIVE"
            ? "A"
            : vendor.status === "ON_HOLD"
              ? "B"
              : "C",
      })),
    );
  },
  { permission: "vendor.read" },
);

export const POST = withRouteAuth(
  async (request, _context, session) => {
    const input = await parseJsonBody(request, vendorCreateSchema);
    const vendor = await vendorService.createVendor(session, input);
    return jsonOk(vendor, { status: 201 });
  },
  { permission: "vendor.write" },
);

// ⚠️ SENIOR NOTE: This route intentionally derives presentation-only fields like rating and last-order display without
// polluting the domain model, which keeps the service focused on operational truth.
