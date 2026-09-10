// One-time / manual FULL load of the Weno EZ LITE pharmacy directory into
// WenoPharmacy (real NCPDP IDs). Downloads the ZIP from Weno using the stored
// EZ credentials, parses the LITE CSV, and full-replaces WenoPharmacy.
// Usage: node scripts/sync-weno-directory.mjs
import crypto from "node:crypto";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function encryptWenoData(pt, key) {
  const k = crypto.createHash("sha256").update(key, "utf8").digest();
  const iv = Buffer.alloc(16, 0);
  const c = crypto.createCipheriv("aes-256-cbc", k, iv);
  return Buffer.concat([c.update(pt, "utf8"), c.final()]).toString("base64");
}
function splitCsvLine(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
const unbracket = (v) => String(v ?? "").trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, "").trim();
const clean = (v) => String(v ?? "").trim().replace(/^"|"$/g, "").trim();
const truthy = (v) => /^(true|y|yes|1)$/i.test(clean(v));

async function main() {
  const t0 = Date.now();
  const row = await db.appSetting.findUnique({ where: { key: "integrations" } });
  const p = row?.value?.providers?.["weno-online"]?.credentials || {};
  const email = p.PROVIDER_EMAIL, pw = p.PROVIDER_PASSWORD, key = p.EHR_ENCRYPTION_KEY;
  if (!email || !pw || !key) throw new Error("Weno EZ config incomplete");
  const data = encryptWenoData(JSON.stringify({ UserEmail: email, MD5Password: pw, Daily: "N" }), key);
  const url = `https://online.wenoexchange.com/en/EPCS/DownloadPharmacyDirectory?useremail=${encodeURIComponent(email)}&data=${encodeURIComponent(data)}`;
  console.log("Downloading Weno LITE directory (full)...");
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!(buf[0] === 0x50 && buf[1] === 0x4b)) {
    const msg = buf.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/Error:[^.]*\./)?.[0] || "non-ZIP response";
    throw new Error("Weno rejected the request: " + msg);
  }
  const zip = await JSZip.loadAsync(buf);
  const csvName = Object.keys(zip.files).find((n) => /lite.*\.csv$/i.test(n)) || Object.keys(zip.files).find((n) => /\.csv$/i.test(n));
  console.log("ZIP ok. Parsing:", csvName);
  const txt = await zip.files[csvName].async("string");
  const lines = txt.split(/\r?\n/);
  const hi = lines.findIndex((l) => /NCPDP/i.test(l));
  const header = splitCsvLine(lines[hi]).map((h) => h.trim());
  const idx = {}; header.forEach((h, i) => { idx[h.replace(/\s+/g, "")] = i; });
  const C = (r, name) => r[idx[name]] ?? "";

  const records = []; let skipped = 0, deleted = 0;
  for (let i = hi + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    const ncpdp = unbracket(C(r, "NCPDP_safe"));
    const name = clean(C(r, "Business_Name"));
    if (!ncpdp || !name) { skipped++; continue; }
    if (clean(C(r, "Deleted"))) { deleted++; continue; }
    const a1 = clean(C(r, "Address_Line_1")), a2 = clean(C(r, "Address_Line_2"));
    const onWeno = truthy(C(r, "On_WENO"));
    const isTest = truthy(C(r, "Test_Pharmacy"));
    const svc = [onWeno ? "weno" : null, isTest ? "test" : null, truthy(C(r, "24HR")) ? "24hr" : null].filter(Boolean).join(",") || null;
    records.push({
      ncpdpId: ncpdp,
      name: name.slice(0, 200),
      address: [a1, a2].filter(Boolean).join(", ") || null,
      city: clean(C(r, "City")) || null,
      state: clean(C(r, "State")) || null,
      zip: unbracket(C(r, "ZipCode_safe")) || null,
      phone: unbracket(C(r, "Pharmacy_Phone_safe")) || null,
      npi: unbracket(C(r, "NPI_safe")) || null,
      services: svc,
      active: true,
      source: "weno-ez-lite",
    });
  }
  // Dedupe by ncpdpId (unique constraint) — keep last occurrence.
  const byId = new Map();
  for (const rec of records) byId.set(rec.ncpdpId, rec);
  const unique = [...byId.values()];
  console.log(`Parsed ${records.length} rows (unique NCPDP ${unique.length}), skipped ${skipped}, deletedFlag ${deleted}.`);

  await db.wenoPharmacy.deleteMany({});
  const CHUNK = 1000; let inserted = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const res2 = await db.wenoPharmacy.createMany({ data: unique.slice(i, i + CHUNK) });
    inserted += res2.count ?? 0;
    if (i % 10000 === 0) process.stdout.write(`\r  inserted ${inserted}/${unique.length}`);
  }
  console.log(`\nDone. WenoPharmacy total: ${await db.wenoPharmacy.count()} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); }).finally(() => db.$disconnect());
