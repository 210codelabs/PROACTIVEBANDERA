// One-off: relabel existing pharmacy/order network values from the old
// "surescripts" label to "weno". Idempotent.
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

const ph = await db.pharmacy.updateMany({ where: { network: "surescripts" }, data: { network: "weno" } }).catch((e) => { console.error("pharmacy:", e.message); return { count: 0 }; });
const ord = await db.order.updateMany({ where: { routingNetwork: "surescripts" }, data: { routingNetwork: "weno" } }).catch((e) => { console.error("order:", e.message); return { count: 0 }; });

console.log(`Relabeled pharmacies: ${ph.count}, orders.routingNetwork: ${ord.count}`);
await db.$disconnect();
