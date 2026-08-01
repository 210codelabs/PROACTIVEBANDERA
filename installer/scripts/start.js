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
  const dbName = process.env.DB_NAME || env.DB_NAME || "proactive_clinic";
  if (!mongo) return process.env.DATABASE_URL; // fall back to frontend/.env

  const qIdx = mongo.indexOf("?");
  let base = qIdx === -1 ? mongo : mongo.slice(0, qIdx);
  let query = qIdx === -1 ? "" : mongo.slice(qIdx);
  base = base.replace(/\/+$/, "");

  const afterScheme = base.slice(base.indexOf("://") + 3);
  if (afterScheme.indexOf("/") === -1) base = `${base}/${dbName}`;

  // Only a local single-node Mongo (dev/preview) needs an explicit replica set
  // flag. Managed production clusters advertise their own replica set (or use
  // mongodb+srv), so forcing rs0 there would break the connection.
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  if (isLocal && base.startsWith("mongodb://") && !/replicaSet=/.test(query)) {
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

  // Reference/master-data catalog powers every clinical dropdown (allergies,
  // medications, diagnoses, billing codes, demographics...). It is seeded by a
  // separate idempotent script, so seed it whenever the catalog is empty — even
  // if users already exist (e.g. first production boot seeded users but not
  // RefData, which left every dropdown blank with only "Create new…").
  const refOut = execSync(
    "node -e \"const {PrismaClient}=require('@prisma/client');const c=new PrismaClient();c.refData.count().then(n=>{console.log('REFCOUNT:'+n);return c.$disconnect();}).catch(e=>{console.error(e);process.exit(1);})\"",
    { encoding: "utf8" }
  );
  const refCount = parseInt((refOut.match(/REFCOUNT:(\d+)/) || [])[1] || "0", 10);
  if (refCount === 0) {
    console.log("[start] reference catalog empty -> seeding refdata");
    run("node scripts/seed-refdata.mjs");
  } else {
    console.log(`[start] reference catalog has ${refCount} records -> skip refdata seed`);
  }
} catch (err) {
  console.error("[start] DB init warning (continuing):", err.message);
}

// Self-heal: drop the obsolete UNIQUE index on Encounter.appointmentId.
// Walk-in encounters have no appointmentId; MongoDB's non-sparse unique index
// only allows ONE document missing that field, so the 2nd walk-in fails with
// "Unique constraint failed on Encounter_appointmentId_key" -> the New Encounter
// page catches it and bounces back to the list ("flicker returns to list" bug).
// The schema relation is now 1:N (no @unique), but `prisma db push` does not
// reliably drop pre-existing Mongo indexes, so we drop it explicitly here.
// Best-effort + idempotent: ignores "index not found" and any DB hiccup.
try {
  console.log("[start] self-heal: dropping stale Encounter_appointmentId_key index if present...");
  execSync(
    "node -e \"const {PrismaClient}=require('@prisma/client');const c=new PrismaClient();c.$runCommandRaw({dropIndexes:'Encounter',index:'Encounter_appointmentId_key'}).then(()=>console.log('dropped stale index')).catch(e=>console.log('index drop skipped:'+(e&&e.message||e))).finally(()=>c.$disconnect());\"",
    { stdio: "inherit" }
  );
} catch (err) {
  console.error("[start] index self-heal warning (continuing):", err.message);
}

console.log("[start] next start...");
run("next start -H 0.0.0.0 -p 3000");
