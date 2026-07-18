import { Prisma, PrismaClient } from "@prisma/client";

export type RepositoryClient = PrismaClient | Prisma.TransactionClient;
