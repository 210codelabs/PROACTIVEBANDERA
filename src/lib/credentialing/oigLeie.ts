// OIG LEIE (List of Excluded Individuals/Entities) matcher.
// The LEIE has no official REST API; it is a monthly CSV download. We lazily
// fetch + cache the CSV and match providers by NPI (preferred) or full name.

type LeieIndex = { npis: Set<string>; names: Set<string>; loadedAt: number; count: number };
let cache: LeieIndex | null = null;
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

// Minimal CSV line splitter that respects double-quoted fields.
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function loadIndex(): Promise<LeieIndex | null> {
  const url = process.env.OIG_LEIE_DATA_URL;
  if (!url) return null;
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  try {
    const res = await fetch(url, { headers: { accept: "text/csv" } });
    if (!res.ok) return cache; // keep any stale cache
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    const header = splitCsv(lines[0] || "").map((h) => h.trim().toUpperCase());
    const iLast = header.indexOf("LASTNAME"), iFirst = header.indexOf("FIRSTNAME"), iNpi = header.indexOf("NPI");
    const npis = new Set<string>(); const names = new Set<string>();
    for (let r = 1; r < lines.length; r++) {
      if (!lines[r]) continue;
      const cols = splitCsv(lines[r]);
      const npi = (iNpi >= 0 ? cols[iNpi] : "").replace(/\D/g, "");
      if (npi && npi !== "0000000000" && npi.length === 10) npis.add(npi);
      const last = (iLast >= 0 ? cols[iLast] : "").trim().toUpperCase();
      const first = (iFirst >= 0 ? cols[iFirst] : "").trim().toUpperCase();
      if (last && first) names.add(`${last}|${first}`);
    }
    cache = { npis, names, loadedAt: Date.now(), count: npis.size + names.size };
    return cache;
  } catch {
    return cache;
  }
}

export async function matchOigLeie(firstName: string, lastName: string, npi: string): Promise<{ screened: boolean; excluded: boolean | null; note: string; raw?: unknown }> {
  const idx = await loadIndex();
  if (!idx) return { screened: false, excluded: null, note: "OIG LEIE not screened (data source unavailable). Verify at oig.hhs.gov/exclusions." };
  const cleanNpi = String(npi || "").replace(/\D/g, "");
  if (cleanNpi && idx.npis.has(cleanNpi)) {
    return { screened: true, excluded: true, note: "OIG LEIE: NPI matches an excluded party — DO NOT credential.", raw: { matchedBy: "npi" } };
  }
  const nameKey = `${String(lastName).trim().toUpperCase()}|${String(firstName).trim().toUpperCase()}`;
  if (idx.names.has(nameKey)) {
    return { screened: true, excluded: true, note: "OIG LEIE: NAME matches an excluded party — verify identity/DOB before credentialing.", raw: { matchedBy: "name" } };
  }
  return { screened: true, excluded: false, note: `OIG LEIE: no match (${idx.npis.size} NPIs indexed).` };
}
