import { PrismaClient } from "@prisma/client";

// Un seul client par processus : en développement, le rechargement à chaud
// créerait sinon une connexion de plus à chaque modification.
const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalPourPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalPourPrisma.prisma = prisma;
