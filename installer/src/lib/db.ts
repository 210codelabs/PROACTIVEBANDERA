import { PrismaClient } from "@prisma/client";

/**
 * Build the MongoDB connection string Prisma should use.
 *
 * IMPORTANT (production vs preview):
 * - The platform injects the correct DB host into `MONGO_URL` in EVERY environment
 *   (localhost in preview, the managed cluster host in production).
 * - `DATABASE_URL` in .env is a dev-only convenience that is HARDCODED to localhost,
 *   so relying on it in production points Prisma at a non-existent local DB and every
 *   query fails. We therefore always derive the URL from `MONGO_URL` at runtime.
 * - Prisma + MongoDB requires a replica set. Local single-node dev needs an explicit
 *   `?replicaSet=rs0`; managed production clusters already advertise their replica set
 *   (or use mongodb+srv), so we must NOT force rs0 there.
 */
function buildDatabaseUrl(): string {
  const mongo = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "proactive_clinic";

  // Fallback to an explicit DATABASE_URL only if MONGO_URL is somehow absent.
  if (!mongo) return process.env.DATABASE_URL || "";

  const [rawBase, rawQuery] = mongo.split("?");
  let base = rawBase.replace(/\/+$/, ""); // strip trailing slashes

  // Ensure the database name is present in the path (mongodb://host[:port]/<db>).
  const afterScheme = base.split("://")[1] || "";
  const hasDbPath = afterScheme.includes("/");
  if (!hasDbPath) base = `${base}/${dbName}`;

  // Preserve any existing query params from MONGO_URL.
  const params = new URLSearchParams(rawQuery || "");

  // Only local single-node dev needs an explicit replica set flag.
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  if (isLocal && !params.has("replicaSet")) {
    params.set("replicaSet", "rs0");
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: { url: buildDatabaseUrl() },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
