import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./db-client";

export { isTurso } from "./db-client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Instance partagée par l'application (réutilisée entre rechargements en dev). */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
