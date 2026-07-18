/**
 * What this file does:
 * Adapts the app's route/service permission checks to the shared validation-layer authorization contract.
 * What calls it:
 * `src/lib/http/route.ts`, `src/services/**`, and UI files that need server-derived permission hints.
 * What it calls:
 * `src/lib/validation/authSchemas.ts` and `src/lib/http/errors.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Maintaining a second RBAC matrix in parallel with the validation boundary, which silently drifts over time.
 */
import type { MembershipRole, PlatformRole } from "@prisma/client";

import {
  AuthorizationError,
  requirePermission as requireValidationPermission,
} from "@/lib/validation";
import { ForbiddenError } from "@/lib/http/errors";

export type AppPermission =
  | "vendor.read"
  | "vendor.write"
  | "rfq.read"
  | "rfq.write"
  | "purchaseOrder.read"
  | "purchaseOrder.write"
  | "purchaseOrder.approve"
  | "purchaseOrder.receive"
  | "report.read"
  | "report.manage"
  | "report.export"
  | "audit.read";

export type PermissionActor = {
  membershipRole: MembershipRole;
  platformRole: PlatformRole;
};

export function hasPermission(actor: PermissionActor, permission: AppPermission) {
  try {
    return requireValidationPermission(actor, permission);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return false;
    }

    throw error;
  }
}

export function assertPermission(actor: PermissionActor, permission: AppPermission) {
  try {
    requireValidationPermission(actor, permission);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new ForbiddenError(error.message);
    }

    throw error;
  }
}

// ⚠️ SENIOR NOTE: UI hiding is not authorization. These helpers are for server-side enforcement, and the UI should only
// mirror their decisions so permission drift cannot create an insecure route.
