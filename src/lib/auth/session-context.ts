/**
 * What this file does:
 * Defines the authenticated request/session shape shared by services, pages, and route handlers.
 * What calls it:
 * `src/services/authService.ts`, `src/lib/http/route.ts`, page guards, and repositories that need tenant scope.
 * What it calls:
 * Prisma enum types only.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Passing around raw Prisma membership records instead of a narrowed app-level auth context.
 */
import { MembershipRole, PlatformRole } from "@prisma/client";

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: MembershipRole;
  platformRole: PlatformRole;
};

// ⚠️ SENIOR NOTE: `tenantId` intentionally duplicates `organizationId` because the product language is "organization"
// while the data-isolation rule is "tenant"; keeping both explicit reduces accidental unscoped repository APIs later.
