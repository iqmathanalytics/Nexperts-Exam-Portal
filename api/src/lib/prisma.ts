import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const DB_CONNECT_TIMEOUT_MS = 12_000;

/** Verify DB on API startup (dev-friendly; logs clear message if TiDB is unreachable). */
export async function connectDatabase() {
  const connect = prisma.$connect();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Database connect timed out after ${DB_CONNECT_TIMEOUT_MS}ms`)), DB_CONNECT_TIMEOUT_MS);
  });
  await Promise.race([connect, timeout]);
  await prisma.$queryRaw`SELECT 1`;
}
