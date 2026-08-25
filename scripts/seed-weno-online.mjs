// Seed / update the Weno Online integration in the DB-backed integration store.
// Reads the EHR Encryption Key from env so no secret lives in the repo:
//   WENO_ONLINE_KEY='...'  WENO_ONLINE_ENV=test  node scripts/seed-weno-online.mjs
//
// It merges the "weno-online" provider into the existing `integrations`
// appSetting WITHOUT clobbering other providers (stedi, weno, etc.).
import { PrismaClient } from "@prisma/client";

function buildDatabaseUrl() {
  const mongo = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "proactive_clinic";
  if (!mongo) return process.env.DATABASE_URL || "";
  const [rawBase, rawQuery] = mongo.split("?");
  let base = rawBase.replace(/\/+$/, "");
  const afterScheme = base.split("://")[1] || "";
  if (!afterScheme.includes("/")) base = `${base}/${dbName}`;
  const params = new URLSearchParams(rawQuery || "");
  if (/localhost|127\.0\.0\.1/.test(base) && !params.has("replicaSet")) params.set("replicaSet", "rs0");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

const db = new PrismaClient({ datasources: { db: { url: buildDatabaseUrl() } } });

const key = process.env.WENO_ONLINE_KEY || "";
const env = (process.env.WENO_ONLINE_ENV || "test").toLowerCase().startsWith("prod") ? "production" : "test";
if (!key) { console.error("WENO_ONLINE_KEY env var is required."); process.exit(1); }

const INTEGRATIONS_KEY = "integrations";
const nowIso = new Date().toISOString();

const row = await db.appSetting.findUnique({ where: { key: INTEGRATIONS_KEY } }).catch(() => null);
const state = (row?.value && typeof row.value === "object") ? row.value : { providers: {}, updatedAt: null };
if (!state.providers) state.providers = {};

const prev = state.providers["weno-online"] || {};
const prevCreds = prev.credentials || {};

state.providers["weno-online"] = {
  enabled: true,
  credentials: {
    EHR_ENCRYPTION_KEY: key,
    ENVIRONMENT: env,
    // Preserve any provider mapping already entered by an admin, unless
    // overridden via env (WENO_ONLINE_EMAIL / _PASSWORD / _LOCATION).
    PROVIDER_EMAIL: process.env.WENO_ONLINE_EMAIL || prevCreds.PROVIDER_EMAIL || "",
    PROVIDER_PASSWORD: process.env.WENO_ONLINE_PASSWORD || prevCreds.PROVIDER_PASSWORD || "",
    LOCATION_ID: process.env.WENO_ONLINE_LOCATION || prevCreds.LOCATION_ID || "",
    WENO_USER_ID: prevCreds.WENO_USER_ID || "",
    COMPOSE_URL_OVERRIDE: prevCreds.COMPOSE_URL_OVERRIDE || "",
  },
  subServices: prev.subServices || {},
  subServiceCredentials: prev.subServiceCredentials || {},
  oauthConnected: false,
  validation: prev.validation || { status: "untested", message: "", checkedAt: null, subServices: {} },
  lastEditedAt: nowIso,
  lastEditedBy: "seed-weno-online script",
};
state.updatedAt = nowIso;

await db.appSetting.upsert({
  where: { key: INTEGRATIONS_KEY },
  create: { key: INTEGRATIONS_KEY, value: state },
  update: { value: state },
});

const masked = key.length <= 4 ? "••••" : "••••" + key.slice(-4);
const mapped = Boolean((process.env.WENO_ONLINE_EMAIL || prevCreds.PROVIDER_EMAIL) && (process.env.WENO_ONLINE_LOCATION || prevCreds.LOCATION_ID));
console.log(`Weno Online seeded: enabled=true env=${env} keyEndsWith=${masked} providerMapping=${mapped ? "set" : "MISSING (add email/password/location in Admin)"}.`);
await db.$disconnect();
