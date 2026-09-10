// Import a Weno EZ "LITE" pharmacy directory CSV into WenoDirectoryPharmacy.
// Usage: node scripts/import-weno-directory.mjs /path/to/weno_pharmacy.csv
// The Weno export has a confidential banner as line 1; the real header is line 2.
// Idempotent: clears the table first, then bulk-inserts.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const db = new PrismaClient();

// Minimal CSV line splitter honoring double-quoted fields (may contain commas).
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const clean = (v) => String(v ?? "").trim().replace(/^"|"$/g, "");
const booly = (v) => /^(true|yes|1|y)$/i.test(clean(v));
// ZipCode_safe comes bracketed, e.g. "[77099]" -> "77099"
const zip = (v) => clean(v).replace(/[[\]]/g, "");

async function main() {
  const path = process.argv[2];
  if (!path || !fs.existsSync(path)) {
    console.error("CSV path missing or not found:", path);
    process.exit(1);
  }
  const text = fs.readFileSync(path, "utf8").replace(/\r/g, "");
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  // Detect header row (contains "Business_Name"); skip any leading banner lines.
  let headerIdx = lines.findIndex((l) => /business_name/i.test(l));
  if (headerIdx < 0) headerIdx = 0;
  const header = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const col = (names) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const idx = {
    onWeno: col(["onweno"]),
    name: col(["businessname", "name"]),
    a1: col(["addressline1", "address1"]),
    a2: col(["addressline2", "address2"]),
    city: col(["city"]),
    state: col(["state"]),
    zip: col(["zipcodesafe", "zipcode", "zip", "postal"]),
    country: col(["countrycode", "country"]),
    mail: col(["mailorder"]),
    app: col(["app"]),
  };

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    const name = idx.name >= 0 ? clean(c[idx.name]) : "";
    if (!name) continue;
    rows.push({
      onWeno: idx.onWeno >= 0 ? booly(c[idx.onWeno]) : false,
      name: name.slice(0, 200),
      address1: idx.a1 >= 0 ? clean(c[idx.a1]) || null : null,
      address2: idx.a2 >= 0 ? clean(c[idx.a2]) || null : null,
      city: idx.city >= 0 ? clean(c[idx.city]) || null : null,
      state: idx.state >= 0 ? clean(c[idx.state]) || null : null,
      zip: idx.zip >= 0 ? zip(c[idx.zip]) || null : null,
      country: idx.country >= 0 ? clean(c[idx.country]) || null : null,
      mailOrder: idx.mail >= 0 ? booly(c[idx.mail]) : false,
      app: idx.app >= 0 ? clean(c[idx.app]) || null : null,
      active: true,
    });
  }

  console.log(`Parsed ${rows.length} pharmacy rows (onWeno=true: ${rows.filter((r) => r.onWeno).length}).`);

  await db.wenoDirectoryPharmacy.deleteMany({});
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const res = await db.wenoDirectoryPharmacy.createMany({ data: batch });
    inserted += res.count ?? batch.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
  }
  console.log(`\nDone. Total in WenoDirectoryPharmacy: ${await db.wenoDirectoryPharmacy.count()}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
