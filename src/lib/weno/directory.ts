import JSZip from "jszip";
import { db } from "@/lib/db";
import { getWenoOnlineConfig, encryptWenoData, WenoOnlineError } from "@/lib/wenoOnline";

// Weno EZ "LITE" Pharmacy Directory download (Step 5 of the EZ Integration guide).
// Downloads the encrypted directory, parses the LITE CSV (which carries real
// NCPDP IDs) and upserts into WenoPharmacy. `daily:false` => full replace;
// `daily:true` => only changed rows (fast, for the scheduled/nightly refresh).
const DIRECTORY_URL = "https://online.wenoexchange.com/en/EPCS/DownloadPharmacyDirectory";

function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
const unbracket = (v: string) => String(v ?? "").trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, "").trim();
const clean = (v: string) => String(v ?? "").trim().replace(/^"|"$/g, "").trim();
const truthy = (v: string) => /^(true|y|yes|1)$/i.test(clean(v));

export type WenoDirectoryResult = {
  ok: boolean;
  mode: "full" | "daily";
  total: number;   // total WenoPharmacy rows after sync
  parsed: number;  // rows parsed from the file
  upserted: number;
  removed: number;
  skipped: number;
  fileName: string;
};

export async function syncWenoDirectory(opts?: { daily?: boolean }): Promise<WenoDirectoryResult> {
  const daily = Boolean(opts?.daily);
  const cfg = await getWenoOnlineConfig();
  if (!cfg.providerEmail || !cfg.providerPassword || !cfg.ehrEncryptionKey) {
    throw new WenoOnlineError("Weno EZ Integration is not fully configured (need admin email, password and EHR Encryption Key).", 400);
  }
  // Field order per the guide: UserEmail, MD5Password, [ExcludeNonWenoTest], Daily.
  // MD5Password accepts plain text; Weno hashes on their side.
  const payload: Record<string, string> = {
    UserEmail: cfg.providerEmail,
    MD5Password: cfg.providerPassword,
    Daily: daily ? "Y" : "N",
  };
  const data = encryptWenoData(JSON.stringify(payload), cfg.ehrEncryptionKey);
  const url = `${DIRECTORY_URL}?useremail=${encodeURIComponent(cfg.providerEmail)}&data=${encodeURIComponent(data)}`;

  const res = await fetch(url, { method: "GET" });
  const buf = Buffer.from(await res.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // 'PK'
  if (!isZip) {
    // Weno returns an HTML page with a human-readable error on bad creds / key / IP.
    const msg = buf.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/Error:[^.]*\./)?.[0]
      || "Weno did not return a directory file (check EZ credentials, encryption key and IP allowlisting).";
    throw new WenoOnlineError(`Weno rejected the directory request. ${msg}`, 502);
  }

  const zip = await JSZip.loadAsync(buf);
  const csvName = Object.keys(zip.files).find((n) => /lite.*\.csv$/i.test(n)) || Object.keys(zip.files).find((n) => /\.csv$/i.test(n));
  if (!csvName) throw new WenoOnlineError("Weno directory ZIP did not contain a CSV file.", 502);
  const txt = await zip.files[csvName].async("string");
  const lines = txt.split(/\r?\n/);
  const hi = lines.findIndex((l) => /NCPDP/i.test(l));
  if (hi < 0) throw new WenoOnlineError("Could not find the header row in the Weno directory file.", 502);
  const header = splitCsvLine(lines[hi]).map((h) => h.trim().replace(/\s+/g, ""));
  const idx: Record<string, number> = {}; header.forEach((h, i) => { idx[h] = i; });
  const C = (r: string[], name: string) => r[idx[name]] ?? "";

  const records: any[] = [];
  const deletedIds: string[] = [];
  let skipped = 0;
  for (let i = hi + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const r = splitCsvLine(lines[i]);
    const ncpdp = unbracket(C(r, "NCPDP_safe"));
    const name = clean(C(r, "Business_Name"));
    if (!ncpdp) { skipped++; continue; }
    if (clean(C(r, "Deleted"))) { deletedIds.push(ncpdp); continue; }
    if (!name) { skipped++; continue; }
    const a1 = clean(C(r, "Address_Line_1")), a2 = clean(C(r, "Address_Line_2"));
    const svc = [truthy(C(r, "On_WENO")) ? "weno" : null, truthy(C(r, "Test_Pharmacy")) ? "test" : null, truthy(C(r, "24HR")) ? "24hr" : null].filter(Boolean).join(",") || null;
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
  // Dedupe by NCPDP (unique key).
  const byId = new Map<string, any>();
  for (const rec of records) byId.set(rec.ncpdpId, rec);
  const unique = [...byId.values()];

  let upserted = 0, removed = 0;
  if (!daily) {
    // Full replace (fast: ~14s for the national LITE file).
    await db.wenoPharmacy.deleteMany({});
    const CHUNK = 1000;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const res2 = await db.wenoPharmacy.createMany({ data: unique.slice(i, i + CHUNK) });
      upserted += res2.count ?? 0;
    }
  } else {
    // Incremental: upsert changed rows, delete rows Weno marked Deleted.
    for (const rec of unique) {
      await db.wenoPharmacy.upsert({ where: { ncpdpId: rec.ncpdpId }, create: rec, update: rec }).then(() => upserted++).catch(() => {});
    }
    if (deletedIds.length) {
      const del = await db.wenoPharmacy.deleteMany({ where: { ncpdpId: { in: deletedIds } } });
      removed = del.count ?? 0;
    }
  }

  const total = await db.wenoPharmacy.count();
  return { ok: true, mode: daily ? "daily" : "full", total, parsed: records.length, upserted, removed, skipped, fileName: csvName };
}
