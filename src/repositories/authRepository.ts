/**
 * What this file does:
 * Encapsulates user, membership, and session persistence used by authentication flows.
 * What calls it:
 * `src/services/authService.ts` and `src/services/seedDemoService.ts`.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Looking up a user by email and then trusting any membership without verifying the target organization.
 */
import { prisma } from "@/lib/prisma/client";

export const authRepository = {
  findMembershipByEmailAndOrganizationSlug(email: string, organizationSlug: string) {
    return prisma.membership.findFirst({
      where: {
        organization: { slug: organizationSlug },
        user: { email },
      },
      include: {
        organization: true,
        user: true,
      },
    });
  },

  findMembershipForUser(userId: string, organizationId: string) {
    return prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          organizationId,
          userId,
        },
      },
      include: {
        organization: true,
        user: true,
      },
    });
  },

  createSession(input: {
    userId: string;
    organizationId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.session.create({
      data: input,
    });
  },

  findSessionByTokenHash(tokenHash: string) {
    return prisma.session.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        user: true,
      },
    });
  },

  deleteSessionById(sessionId: string) {
    return prisma.session.deleteMany({
      where: { id: sessionId },
    });
  },

  countOrganizations() {
    return prisma.organization.count();
  },
};

// ⚠️ SENIOR NOTE: Authentication reads should always bind user identity to a specific organization membership; otherwise
// a user with access to one tenant can accidentally inherit access to another through a shared email account.
