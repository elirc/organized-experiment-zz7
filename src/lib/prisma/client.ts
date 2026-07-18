/**
 * What this file does:
 * Exposes a singleton Prisma client for all repositories.
 * What calls it:
 * Every repository under `src/repositories/**`.
 * What it calls:
 * `PrismaClient` from `@prisma/client`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Instantiating a new Prisma client per request, which causes connection churn and noisy local development.
 */
import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

// ⚠️ SENIOR NOTE: In a serverless deployment, client reuse strategy needs to match the runtime; the wrong approach can
// exhaust database connections under burst traffic.
