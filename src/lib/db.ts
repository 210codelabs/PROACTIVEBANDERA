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

/**
 * Add connection-pool / resilience params so many concurrent users don't
 * exhaust the MongoDB connection cap (the usual cause of "some resources
 * become inaccessible under load"). Tunable via env without code changes.
 */
function withPool(url: string): string {
  if (!url) return url;
  try {
    const [base, query] = url.split("?");
    const p = new URLSearchParams(query || "");
    if (!p.has("maxPoolSize")) p.set("maxPoolSize", process.env.MONGO_MAX_POOL || "20");
    if (!p.has("minPoolSize")) p.set("minPoolSize", process.env.MONGO_MIN_POOL || "0");
    if (!p.has("maxIdleTimeMS")) p.set("maxIdleTimeMS", "60000");
    if (!p.has("serverSelectionTimeoutMS")) p.set("serverSelectionTimeoutMS", "10000");
    if (!p.has("waitQueueTimeoutMS")) p.set("waitQueueTimeoutMS", "10000");
    return `${base}?${p.toString()}`;
  } catch {
    return url;
  }
}

/**
 * Production runs on Alpine (musl) arm64 with OpenSSL 3. Prisma's OpenSSL
 * detection can fail there and "default to openssl-1.1.x", trying to load an
 * engine that needs libssl.so.1.1 (absent) -> every query throws. Pin the
 * correct OpenSSL-3 engine explicitly when we're on musl and it exists.
 */
function pinPrismaEngine() {
  try {
    if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const isMusl = fs.existsSync("/etc/alpine-release") || fs.readdirSync("/lib").some((f) => f.startsWith("ld-musl"));
    if (!isMusl) return;
    const file = process.arch === "arm64"
      ? "libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node"
      : "libquery_engine-linux-musl-openssl-3.0.x.so.node";
    const dirs = [
      path.join(process.cwd(), "node_modules", ".prisma", "client"),
      path.join(process.cwd(), "node_modules", "@prisma", "client"),
      path.join(process.cwd(), ".next", "server"),
      path.join(process.cwd(), "prisma"),
    ];
    for (const d of dirs) {
      const p = path.join(d, file);
      if (fs.existsSync(p)) { process.env.PRISMA_QUERY_ENGINE_LIBRARY = p; return; }
    }
  } catch { /* fall back to Prisma's own detection */ }
}
pinPrismaEngine();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: { url: withPool(buildDatabaseUrl()) },
    },
  });

// Cache the singleton in ALL environments (including production) so we never
// create multiple PrismaClients — each extra client opens its own pool and can
// blow past the cluster's connection limit.
globalForPrisma.prisma = db;
