import { Prisma } from "@prisma/client";

export function prismaErrorStatus(err: unknown): number | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P1001" || err.code === "P1002") return 503;
    if (err.code === "P2025") return 404;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return 503;
  return null;
}

export function prismaErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P1001" || err.code === "P1002")) {
    return "Database is temporarily unavailable. Check your network or TiDB cluster, then try again.";
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return "Database connection failed. Verify DATABASE_URL in api/.env.";
  }
  return "Internal server error";
}
