const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

// Resolve the MongoDB connection string for Prisma (DATABASE_URL) from the
// platform-injected MONGO_URL / DB_NAME. Emergent injects these per environment
// (local Mongo in preview, dedicated Atlas cluster in production) into
// backend/.env, so we mirror that value here instead of hardcoding it.
function readBackendEnv() {
  const out = {};
  try {
    const raw = fs.readFileSync("/app/backend/.env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}

function buildDatabaseUrl() {
  const env = readBackendEnv();
  const mongo = process.env.MONGO_URL || env.MONGO_URL;
  const dbName = process.env.DB_NAME || env.DB_NAME || "apexcare_ehr";
  if (!mongo) return process.env.DATABASE_URL; // fall back to frontend/.env

  const qIdx = mongo.indexOf("?");
  let base = qIdx === -1 ? mongo : mongo.slice(0, qIdx);
  let query = qIdx === -1 ? "" : mongo.slice(qIdx);
  base = base.replace(/\/+$/, "");

  const afterScheme = base.slice(base.indexOf("://") + 3);
  if (afterScheme.indexOf("/") === -1) base = `${base}/${dbName}`;

  // A plain mongodb:// host (local dev) must be a replica set for Prisma.
  if (base.startsWith("mongodb://") && !/replicaSet=/.test(query)) {
    query = query ? `${query}&replicaSet=rs0` : "?replicaSet=rs0";
  }
  return base + query;
}

const dbUrl = buildDatabaseUrl();
if (dbUrl) process.env.DATABASE_URL = dbUrl;
console.log(`[start] DATABASE_URL host -> ${(dbUrl || "").replace(/\/\/[^@]*@/, "//***@")}`);

// Explicit dev override for local hot-reload work only.
if (process.env.NODE_ENV === "development") {
  console.log("[start] NODE_ENV=development -> next dev (hot reload)");
  run("next dev -H 0.0.0.0 -p 3000");
  return;
}

// Everything else (preview default + production deploy) serves a real
// production build. Precompiled routes answer the K8s readiness probe
// immediately, unlike dev on-demand compilation which times it out.
console.log("[start] production mode");

if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) {
  console.log("[start] no build found -> next build");
  run("next build");
}

// Best-effort DB init. Non-fatal on purpose so a DB hiccup never crash-loops
// the pod and blocks readiness.
try {
  console.log("[start] prisma db push...");
  run("npx prisma db push --skip-generate");
  const out = execSync(
    "node -e \"const {PrismaClient}=require('@prisma/client');const c=new PrismaClient();c.user.count().then(n=>{console.log('COUNT:'+n);return c.$disconnect();}).catch(e=>{console.error(e);process.exit(1);})\"",
    { encoding: "utf8" }
  );
  const count = parseInt((out.match(/COUNT:(\d+)/) || [])[1] || "0", 10);
  if (count === 0) {
    console.log("[start] database empty -> seeding");
    run("npx tsx prisma/seed.ts");
  } else {
    console.log(`[start] database has ${count} users -> skip seed`);
  }
} catch (err) {
  console.error("[start] DB init warning (continuing):", err.message);
}

console.log("[start] next start...");
run("next start -H 0.0.0.0 -p 3000");
