/**
 * What this file does:
 * Persists audit log entries for security-sensitive and workflow-changing actions.
 * What calls it:
 * Domain services in `src/services/**`.
 * What it calls:
 * Prisma via `src/lib/prisma/client.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Logging only happy-path creates and skipping approvals, receives, and exports where forensic value is highest.
 */
import type { RepositoryClient } from "@/repositories/repository-types";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@prisma/client";

function getDb(client?: RepositoryClient) {
  return client ?? prisma;
}

export const auditLogRepository = {
  create(
    input: {
      tenantId: string;
      actorUserId: string;
      entityType: string;
      entityId: string;
      action: string;
      metadata?: Prisma.InputJsonValue;
    },
    client?: RepositoryClient,
  ) {
    return getDb(client).auditLog.create({
      data: input,
    });
  },
};

// ⚠️ SENIOR NOTE: Audit logs should be written inside the same transaction as the business change when practical, or the
// system will claim an action never happened even though the state changed.
