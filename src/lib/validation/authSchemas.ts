/**
 * What this file does: Validates login/session payloads and centralizes role-based permission checks.
 * What calls it: Future auth routes, middleware, and service guards.
 * What it calls: Shared primitives from `common.ts` and Zod.
 * Junior gotcha: Checking a role in the UI is not authorization; the guard needs to live at the boundary.
 */
import { z } from "zod";
import { tenantIdSchema, nonEmptyTrimmedStringSchema } from "./common";

export const platformRoleSchema = z.enum(["USER", "SUPER_ADMIN"]);
export const membershipRoleSchema = z.enum([
  "ORG_ADMIN",
  "PROCUREMENT_MANAGER",
  "BUYER",
  "AP_CLERK",
  "ANALYST",
  "VIEWER",
]);

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(12),
  organizationSlug: nonEmptyTrimmedStringSchema,
});

export const sessionClaimsSchema = z.object({
  userId: z.string().min(1),
  organizationId: tenantIdSchema,
  membershipRole: membershipRoleSchema,
  platformRole: platformRoleSchema,
  expiresAt: z.coerce.date(),
});

export const permissionActionSchema = z.enum([
  "vendor.read",
  "vendor.write",
  "rfq.read",
  "rfq.write",
  "purchaseOrder.read",
  "purchaseOrder.write",
  "purchaseOrder.approve",
  "purchaseOrder.receive",
  "report.read",
  "report.manage",
  "report.export",
  "audit.read",
]);

export const rolePermissionMatrix: Record<
  z.infer<typeof membershipRoleSchema>,
  ReadonlySet<z.infer<typeof permissionActionSchema>>
> = {
  ORG_ADMIN: new Set([
    "vendor.read",
    "vendor.write",
    "rfq.read",
    "rfq.write",
    "purchaseOrder.read",
    "purchaseOrder.write",
    "purchaseOrder.approve",
    "purchaseOrder.receive",
    "report.read",
    "report.manage",
    "report.export",
    "audit.read",
  ]),
  PROCUREMENT_MANAGER: new Set([
    "vendor.read",
    "vendor.write",
    "rfq.read",
    "rfq.write",
    "purchaseOrder.read",
    "purchaseOrder.write",
    "purchaseOrder.approve",
    "purchaseOrder.receive",
    "report.read",
    "report.export",
  ]),
  BUYER: new Set([
    "vendor.read",
    "rfq.read",
    "rfq.write",
    "purchaseOrder.read",
    "purchaseOrder.write",
    "report.read",
    "report.export",
  ]),
  AP_CLERK: new Set([
    "purchaseOrder.read",
    "purchaseOrder.receive",
    "report.read",
    "report.export",
  ]),
  ANALYST: new Set(["report.read", "report.manage", "report.export", "audit.read"]),
  VIEWER: new Set(["vendor.read", "rfq.read", "purchaseOrder.read", "report.read"]),
};

export class AuthorizationError extends Error {
  statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requirePermission(
  context: { membershipRole: z.infer<typeof membershipRoleSchema>; platformRole: z.infer<typeof platformRoleSchema> },
  action: z.infer<typeof permissionActionSchema>,
) {
  if (context.platformRole === "SUPER_ADMIN") {
    return true;
  }

  const allowed = rolePermissionMatrix[context.membershipRole];
  if (!allowed.has(action)) {
    throw new AuthorizationError(`Role ${context.membershipRole} cannot perform ${action}`);
  }

  return true;
}

export function assertTenantScope(contextOrganizationId: string, resourceOrganizationId: string) {
  if (contextOrganizationId !== resourceOrganizationId) {
    // We fail closed here because tenant mismatch is a data leak, not a simple validation error.
    throw new AuthorizationError("Tenant scope mismatch");
  }

  return true;
}

// ⚠️ SENIOR NOTE: If this matrix drifts from route guards later, the UI will still look correct while the API becomes inconsistent.
