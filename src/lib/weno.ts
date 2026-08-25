import crypto from "node:crypto";
import { readIntegrations } from "@/lib/integrations/store";
import { db } from "@/lib/db";

// -----------------------------------------------------------------------------
// Weno Exchange e-prescribing client (NCPDP SCRIPT 20170715 over SOAP).
// Credentials are read from the DB-backed integration store (Admin -> External
// Integrations -> Weno Exchange). This module never hardcodes secrets.
//
// IMPORTANT REALITY: Weno is NOT a JSON REST API. It uses SOAP + NCPDP SCRIPT
// XML, gated credentials, IP allowlisting and a certification process. The XML
// shapes below are the documented illustrative shapes; exact certification
// schemas come from Weno's dashboard. Live transmission requires valid
// credentials + Weno onboarding. EPCS/controlled substances additionally
// require Weno DEA-audit approval and prescriber identity proofing.
// -----------------------------------------------------------------------------

export type WenoConfig = {
  enabled: boolean;
  environment: "test" | "production";
  partnerId: string;
  partnerPassword: string;
  md5Password: string;
  prescriberRoutingId: string;
  senderName: string;
  senderVersion: string;
  switchEndpoint: string;
  directoryBase: string;
  subServices: Record<string, boolean>;
  epcsEnabled: boolean;
};

export class WenoError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

function md5(s: string) { return crypto.createHash("md5").update(s, "utf8").digest("hex"); }

// Fetch with a hard timeout so a hung Weno host fails cleanly instead of
// bubbling up as a proxy 502 after the platform's request ceiling.
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function getWenoConfig(): Promise<WenoConfig> {
  const state = await readIntegrations();
  const p = state.providers["weno"];
  const c = p?.credentials || {};
  const env = (String(c.ENVIRONMENT || "test").toLowerCase().startsWith("prod") ? "production" : "test") as "test" | "production";
  const partnerPassword = c.PARTNER_PASSWORD || "";
  const md5Password = (c.MD5_PASSWORD || "").trim() || (partnerPassword ? md5(partnerPassword) : "");
  const directoryBase = env === "production" ? "https://live.wenoexchange.com" : "https://cert.wenoexchange.com";
  const defaultSwitch = `${directoryBase}/wenox/service.asmx`;
  return {
    enabled: Boolean(p?.enabled),
    environment: env,
    partnerId: c.PARTNER_ID || "",
    partnerPassword,
    md5Password,
    prescriberRoutingId: c.PRESCRIBER_ROUTING_ID || c.PARTNER_ID || "",
    senderName: c.SENDER_SOFTWARE_NAME || "ProactiveClinics EHR",
    senderVersion: c.SENDER_SOFTWARE_VERSION || "1.0",
    switchEndpoint: (c.ENDPOINT_OVERRIDE || "").trim() || defaultSwitch,
    directoryBase,
    subServices: p?.subServices || {},
    epcsEnabled: Boolean(p?.subServices?.epcs),
  };
}

const esc = (s: string) =>
  String(s ?? "").replace(/[<>&'\"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" }[c] as string));

export type NewRxInput = {
  messageId?: string;
  patient: { first: string; last: string; dob?: string; gender?: string; address1?: string; city?: string; state?: string; zip?: string };
  pharmacyNcpdp: string;
  drugDescription: string;
  drugCode?: string;
  drugQualifier?: string;
  deaSchedule?: string; // "0" for non-controlled
  quantity?: string;
  unitCode?: string;
  daysSupply?: string;
  refills?: string;
  sig?: string;
  prescriberNpi?: string;
  prescriberLast?: string;
  prescriberFirst?: string;
};

export function newMessageId() { return crypto.randomUUID().replace(/-/g, ""); }

export function buildNewRxXml(cfg: WenoConfig, x: NewRxInput): { xml: string; messageId: string } {
  const id = x.messageId || newMessageId();
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Message DatatypesVersion="20170715" TransportVersion="20170715" TransactionDomain="SCRIPT" TransactionVersion="20170715" StructuresVersion="20170715" ECLVersion="20170715">
 <Header><To Qualifier="P">${esc(x.pharmacyNcpdp)}</To><From Qualifier="D">${esc(cfg.prescriberRoutingId)}</From><MessageID>${id}</MessageID><SentTime>${now}</SentTime>
  <Security><UsernameToken><Username>${esc(cfg.partnerId)}</Username><Password Type="PasswordDigest">${esc(cfg.md5Password)}</Password></UsernameToken></Security>
  <SenderSoftware><SenderSoftwareDeveloper>ProactiveClinics</SenderSoftwareDeveloper><SenderSoftwareProduct>${esc(cfg.senderName)}</SenderSoftwareProduct><SenderSoftwareVersionRelease>${esc(cfg.senderVersion)}</SenderSoftwareVersionRelease></SenderSoftware>
  <DigitalSignature Version="Not Applicable"><DigitalSignatureIndicator>0</DigitalSignatureIndicator></DigitalSignature>
 </Header>
 <Body><NewRx><ReturnReceipt>001</ReturnReceipt>
  <Patient><HumanPatient><Name><LastName>${esc(x.patient.last)}</LastName><FirstName>${esc(x.patient.first)}</FirstName></Name><Gender>${esc(x.patient.gender || "U")}</Gender><DateOfBirth><Date>${esc(x.patient.dob || "")}</Date></DateOfBirth><Address><AddressLine1>${esc(x.patient.address1 || "")}</AddressLine1><City>${esc(x.patient.city || "")}</City><StateProvince>${esc(x.patient.state || "")}</StateProvince><PostalCode>${esc(x.patient.zip || "")}</PostalCode><CountryCode>US</CountryCode></Address></HumanPatient></Patient>
  <Pharmacy><Identification><NCPDPID>${esc(x.pharmacyNcpdp)}</NCPDPID></Identification></Pharmacy>
  <Prescriber><NonVeterinarian><Identification><NPI>${esc(x.prescriberNpi || "")}</NPI></Identification><Name><LastName>${esc(x.prescriberLast || "")}</LastName><FirstName>${esc(x.prescriberFirst || "")}</FirstName></Name></NonVeterinarian></Prescriber>
  <MedicationPrescribed><DrugDescription>${esc(x.drugDescription)}</DrugDescription><DrugCoded><DrugDBCode><Code>${esc(x.drugCode || "")}</Code><Qualifier>${esc(x.drugQualifier || "SBD")}</Qualifier></DrugDBCode><DEASchedule><Code>${esc(x.deaSchedule || "0")}</Code></DEASchedule></DrugCoded><Quantity><Value>${esc(x.quantity || "1")}</Value><CodeListQualifier>38</CodeListQualifier><QuantityUnitOfMeasure><Code>${esc(x.unitCode || "C48542")}</Code></QuantityUnitOfMeasure></Quantity><DaysSupply>${esc(x.daysSupply || "30")}</DaysSupply><WrittenDate><DateTime>${now}</DateTime></WrittenDate><Substitutions>0</Substitutions><NumberOfRefills>${esc(x.refills || "0")}</NumberOfRefills><Sig><SigText>${esc(x.sig || "")}</SigText></Sig></MedicationPrescribed>
 </NewRx></Body></Message>`;
  return { xml, messageId: id };
}

export type SwitchResult = { httpStatus: number; raw: string; state: string; statusText: string; code?: string };

export function parseSwitchResponse(raw: string): { state: string; statusText: string; code?: string } {
  const text = String(raw || "");
  const codeMatch = text.match(/<Code>([^<]*)<\/Code>/i);
  const descMatch = text.match(/<Description>([^<]*)<\/Description>/i);
  const code = codeMatch?.[1]?.trim();
  const desc = descMatch?.[1]?.trim();
  if (/<Error\b/i.test(text) || /<ErrorCode>/i.test(text)) {
    return { state: "rejected", statusText: desc || "Weno returned an error.", code };
  }
  if (/<Status\b/i.test(text) || /<Verify\b/i.test(text)) {
    return { state: "accepted", statusText: desc || "Accepted by Weno for delivery.", code };
  }
  return { state: "submitted", statusText: desc || "Submitted to Weno.", code };
}

export async function sendSwitch(message: string): Promise<SwitchResult> {
  const cfg = await getWenoConfig();
  if (!cfg.partnerId || !cfg.md5Password) throw new WenoError("Weno credentials are not configured. Add them in Admin -> Integrations.", 400);
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>
<wenoswitch xmlns="http://tempuri.org/"><inputString>${esc(message)}</inputString></wenoswitch>
</soap12:Body></soap12:Envelope>`;
  let r: Response;
  try {
    r = await fetchWithTimeout(cfg.switchEndpoint, { method: "POST", headers: { "Content-Type": "application/soap+xml; charset=utf-8" }, body: soap, cache: "no-store" }, 25000);
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    throw new WenoError(aborted ? "Weno endpoint timed out (25s). Confirm the endpoint + IP allowlist." : `Could not reach Weno endpoint: ${String(e?.message || e).slice(0, 160)}`);
  }
  const raw = await r.text();
  if (!r.ok) throw new WenoError(`Weno HTTP ${r.status}: ${raw.slice(0, 160)}`, r.status);
  const parsed = parseSwitchResponse(raw);
  return { httpStatus: r.status, raw, ...parsed };
}

// Directory download doubles as the real "Test Connection": it validates the
// partner credentials + IP allowlist via HTTP Basic auth (partnerId:md5).
export async function wenoDirectoryPing(kind: "PharmacyDirectory" | "DrugDBDirectory" | "PrescriberDirectory" = "PharmacyDirectory"): Promise<{ ok: true; bytes: number }> {
  const buf = await fetchDirectoryBuffer(kind);
  return { ok: true, bytes: buf.byteLength };
}

async function fetchDirectoryBuffer(kind: "PharmacyDirectory" | "DrugDBDirectory" | "PrescriberDirectory"): Promise<Buffer> {
  const cfg = await getWenoConfig();
  if (!cfg.partnerId || !cfg.md5Password) throw new WenoError("Weno Partner ID / password are required.", 400);
  const token = Buffer.from(`${cfg.partnerId}:${cfg.md5Password}`).toString("base64");
  const url = `${cfg.directoryBase}/wenox/GetListResponse.aspx?${kind}=yes`;
  let r: Response;
  try {
    r = await fetchWithTimeout(url, { headers: { Authorization: `Basic ${token}` }, cache: "no-store" }, 40000);
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    throw new WenoError(aborted ? `Weno directory request timed out (40s) at ${cfg.directoryBase}. Confirm your outbound IP is allowlisted in the Weno dashboard.` : `Could not reach Weno (${cfg.directoryBase}). Confirm your outbound IP is allowlisted in the Weno dashboard. ${String(e?.message || e).slice(0, 120)}`);
  }
  if (r.status === 401 || r.status === 403) throw new WenoError(`Weno rejected the credentials (HTTP ${r.status}). Verify Partner ID + password/MD5 and that this server's IP is allowlisted.`, r.status);
  if (!r.ok) throw new WenoError(`Weno directory request failed (HTTP ${r.status}).`, r.status);
  return Buffer.from(await r.arrayBuffer());
}

export type ParsedPharmacy = {
  ncpdpId: string; name: string; address?: string; city?: string; state?: string;
  zip?: string; phone?: string; fax?: string; npi?: string; services?: string; raw: string;
};

// Defensive parser for Weno's pharmacy directory. The exact columns come from
// the Weno dashboard and can change, so we auto-detect the delimiter and map
// header names heuristically, preserving the original row.
export function parseDirectory(text: string): ParsedPharmacy[] {
  const clean = String(text || "").replace(/\r/g, "");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = [",", "\t", "|"].map((d) => ({ d, n: (lines[0].match(new RegExp(`\\${d}`, "g")) || []).length })).sort((a, b) => b.n - a.n)[0].d;
  const split = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const looksLikeHeader = header.some((h) => /ncpdp|pharmacy|name|city|state/.test(h));
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const col = {
    ncpdp: idx(["ncpdp", "pharmacyid", "storeid"]),
    name: idx(["name", "pharmacy"]),
    address: idx(["address", "street", "addr"]),
    city: idx(["city"]),
    state: idx(["state", "province"]),
    zip: idx(["zip", "postal"]),
    phone: idx(["phone", "tele"]),
    fax: idx(["fax"]),
    npi: idx(["npi"]),
    services: idx(["service", "capab", "epcs"]),
  };
  const rows = looksLikeHeader ? lines.slice(1) : lines;
  const out: ParsedPharmacy[] = [];
  for (const line of rows) {
    const c = split(line);
    const ncpdpId = (col.ncpdp >= 0 ? c[col.ncpdp] : c[0]) || "";
    const name = (col.name >= 0 ? c[col.name] : c[1]) || "";
    if (!ncpdpId || !/^\w[\w-]*$/.test(ncpdpId)) continue;
    out.push({
      ncpdpId, name: name || ncpdpId,
      address: col.address >= 0 ? c[col.address] : undefined,
      city: col.city >= 0 ? c[col.city] : undefined,
      state: col.state >= 0 ? c[col.state] : undefined,
      zip: col.zip >= 0 ? c[col.zip] : undefined,
      phone: col.phone >= 0 ? c[col.phone] : undefined,
      fax: col.fax >= 0 ? c[col.fax] : undefined,
      npi: col.npi >= 0 ? c[col.npi] : undefined,
      services: col.services >= 0 ? c[col.services] : undefined,
      raw: line.slice(0, 500),
    });
  }
  return out;
}

export async function downloadPharmacyDirectory(): Promise<ParsedPharmacy[]> {
  const buf = await fetchDirectoryBuffer("PharmacyDirectory");
  // Best-effort: treat as UTF-8 text (Weno may zip large files; if so the admin
  // should confirm format — we surface a clear error rather than guessing).
  const text = buf.toString("utf8");
  if (/^PK\x03\x04/.test(text) || text.includes("\x00")) {
    throw new WenoError("The Weno directory came back as a binary/zip file. Ask Weno for the delimited (CSV) directory format for API partners.");
  }
  return parseDirectory(text);
}

// ---- Directory sync (shared by the admin route + the nightly scheduler) ----
export type WenoDirState = { autoSync: boolean; lastSyncAt: string | null; lastResult: string | null; lastError: string | null };
const DIR_STATE_KEY = "weno_directory";

export async function getWenoDirState(): Promise<WenoDirState> {
  const s = await db.appSetting.findUnique({ where: { key: DIR_STATE_KEY } }).catch(() => null);
  const v: any = (s?.value as any) || {};
  return { autoSync: Boolean(v.autoSync), lastSyncAt: v.lastSyncAt || null, lastResult: v.lastResult || null, lastError: v.lastError || null };
}

export async function setWenoDirState(patch: Partial<WenoDirState>): Promise<WenoDirState> {
  const cur = await getWenoDirState();
  const next = { ...cur, ...patch };
  await db.appSetting.upsert({ where: { key: DIR_STATE_KEY }, create: { key: DIR_STATE_KEY, value: next as any }, update: { value: next as any } });
  return next;
}

export async function runDirectorySync(): Promise<{ imported: number; total: number }> {
  const rows = await downloadPharmacyDirectory();
  const capped = rows.slice(0, 20000);
  let imported = 0;
  for (const p of capped) {
    try {
      await db.wenoPharmacy.upsert({
        where: { ncpdpId: p.ncpdpId },
        create: { ncpdpId: p.ncpdpId, name: p.name, address: p.address || null, city: p.city || null, state: p.state || null, zip: p.zip || null, phone: p.phone || null, fax: p.fax || null, npi: p.npi || null, services: p.services || null, raw: p.raw || null },
        update: { name: p.name, address: p.address || null, city: p.city || null, state: p.state || null, zip: p.zip || null, phone: p.phone || null, fax: p.fax || null, npi: p.npi || null, services: p.services || null, raw: p.raw || null, active: true },
      });
      imported++;
    } catch { /* skip bad row */ }
  }
  await setWenoDirState({ lastSyncAt: new Date().toISOString(), lastResult: `Imported ${imported} of ${rows.length}`, lastError: null });
  return { imported, total: rows.length };
}

// Called by the scheduler: only sync when auto-sync is on, creds exist, and the
// last successful sync is older than ~24h.
export async function maybeAutoSyncDirectory(): Promise<{ ran: boolean; reason?: string }> {
  const cfg = await getWenoConfig();
  if (!cfg.enabled || !cfg.partnerId || !cfg.md5Password) return { ran: false, reason: "not configured" };
  const st = await getWenoDirState();
  if (!st.autoSync) return { ran: false, reason: "auto-sync off" };
  const last = st.lastSyncAt ? new Date(st.lastSyncAt).getTime() : 0;
  if (Date.now() - last < 23 * 60 * 60 * 1000) return { ran: false, reason: "synced recently" };
  try {
    const res = await runDirectorySync();
    return { ran: true, reason: `imported ${res.imported}` };
  } catch (e: any) {
    await setWenoDirState({ lastError: String(e?.message || e).slice(0, 300) });
    return { ran: false, reason: "sync failed" };
  }
}

// Documented Weno TEST pharmacy so clinicians can pick a destination while in
// the test/cert environment before a real directory sync.
export const WENO_TEST_PHARMACIES: ParsedPharmacy[] = [
  { ncpdpId: "1234567", name: "Weno Test Pharmacy", city: "Test City", state: "TX", zip: "78201", phone: "(210) 555-0100", services: "NewRx", raw: "built-in test pharmacy" },
];

// Build a CancelRx SCRIPT message that references the original NewRx MessageID.
export function buildCancelRxXml(cfg: WenoConfig, x: {
  relatesToMessageId: string; pharmacyNcpdp: string; messageId?: string;
  patient: { first: string; last: string; dob?: string; gender?: string };
  prescriberNpi?: string; prescriberLast?: string; prescriberFirst?: string;
  drugDescription: string;
}): { xml: string; messageId: string } {
  const id = x.messageId || newMessageId();
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Message DatatypesVersion="20170715" TransportVersion="20170715" TransactionDomain="SCRIPT" TransactionVersion="20170715" StructuresVersion="20170715" ECLVersion="20170715">
 <Header><To Qualifier="P">${esc(x.pharmacyNcpdp)}</To><From Qualifier="D">${esc(cfg.prescriberRoutingId)}</From><MessageID>${id}</MessageID><RelatesToMessageID>${esc(x.relatesToMessageId)}</RelatesToMessageID><SentTime>${now}</SentTime>
  <Security><UsernameToken><Username>${esc(cfg.partnerId)}</Username><Password Type="PasswordDigest">${esc(cfg.md5Password)}</Password></UsernameToken></Security>
  <SenderSoftware><SenderSoftwareDeveloper>ProactiveClinics</SenderSoftwareDeveloper><SenderSoftwareProduct>${esc(cfg.senderName)}</SenderSoftwareProduct><SenderSoftwareVersionRelease>${esc(cfg.senderVersion)}</SenderSoftwareVersionRelease></SenderSoftware>
 </Header>
 <Body><CancelRx>
  <Patient><HumanPatient><Name><LastName>${esc(x.patient.last)}</LastName><FirstName>${esc(x.patient.first)}</FirstName></Name><Gender>${esc(x.patient.gender || "U")}</Gender><DateOfBirth><Date>${esc(x.patient.dob || "")}</Date></DateOfBirth></HumanPatient></Patient>
  <Pharmacy><Identification><NCPDPID>${esc(x.pharmacyNcpdp)}</NCPDPID></Identification></Pharmacy>
  <Prescriber><NonVeterinarian><Identification><NPI>${esc(x.prescriberNpi || "")}</NPI></Identification><Name><LastName>${esc(x.prescriberLast || "")}</LastName><FirstName>${esc(x.prescriberFirst || "")}</FirstName></Name></NonVeterinarian></Prescriber>
  <MedicationPrescribed><DrugDescription>${esc(x.drugDescription)}</DrugDescription></MedicationPrescribed>
 </CancelRx></Body></Message>`;
  return { xml, messageId: id };
}
