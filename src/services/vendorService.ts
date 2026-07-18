/**
 * What this file does:
 * Owns vendor-facing business actions and the audit trail around them.
 * What calls it:
 * `src/app/api/vendors/route.ts`.
 * What it calls:
 * `src/repositories/vendorRepository.ts` and `src/repositories/auditLogRepository.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Letting the route call the repository directly and skipping audit/logging rules.
 */
import type { AuthenticatedSession } from "@/lib/auth/session-context";
import { auditLogRepository } from "@/repositories/auditLogRepository";
import { vendorRepository } from "@/repositories/vendorRepository";
import { serializeVendor } from "@/services/serializers";

export const vendorService = {
  async listVendors(session: AuthenticatedSession) {
    const vendors = await vendorRepository.listForTenant(session.tenantId);
    return vendors.map(serializeVendor);
  },

  async createVendor(
    session: AuthenticatedSession,
    input: {
      name: string;
      code: string;
      paymentTerms: string;
      country: string;
      contactEmail: string;
    },
  ) {
    const vendor = await vendorRepository.create({
      ...input,
      tenantId: session.tenantId,
    });

    await auditLogRepository.create({
      action: "vendor.created",
      actorUserId: session.userId,
      entityId: vendor.id,
      entityType: "Vendor",
      metadata: { code: vendor.code, name: vendor.name },
      tenantId: session.tenantId,
    });

    return serializeVendor(vendor);
  },
};

// ⚠️ SENIOR NOTE: Vendor writes often look harmless, but changes here affect downstream sourcing, purchasing, and
// reporting joins, so they should always leave an audit trail.
