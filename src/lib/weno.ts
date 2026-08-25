import crypto from "node:crypto";
import { readIntegrations } from "@/lib/integrations/store";

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
    r = await fetch(cfg.switchEndpoint, { method: "POST", headers: { "Content-Type": "application/soap+xml; charset=utf-8" }, body: soap, cache: "no-store" });
  } catch (e: any) {
    throw new WenoError(`Could not reach Weno endpoint: ${String(e?.message || e).slice(0, 160)}`);
  }
  const raw = await r.text();
  if (!r.ok) throw new WenoError(`Weno HTTP ${r.status}: ${raw.slice(0, 160)}`, r.status);
  const parsed = parseSwitchResponse(raw);
  return { httpStatus: r.status, raw, ...parsed };
}

// Directory download doubles as the real "Test Connection": it validates the
// partner credentials + IP allowlist via HTTP Basic auth (partnerId:md5).
export async function wenoDirectoryPing(kind: "PharmacyDirectory" | "DrugDBDirectory" | "PrescriberDirectory" = "PharmacyDirectory"): Promise<{ ok: true; bytes: number }> {
  const cfg = await getWenoConfig();
  if (!cfg.partnerId || !cfg.md5Password) throw new WenoError("Weno Partner ID / password are required.", 400);
  const token = Buffer.from(`${cfg.partnerId}:${cfg.md5Password}`).toString("base64");
  const url = `${cfg.directoryBase}/wenox/GetListResponse.aspx?${kind}=yes`;
  let r: Response;
  try {
    r = await fetch(url, { headers: { Authorization: `Basic ${token}` }, cache: "no-store" });
  } catch (e: any) {
    throw new WenoError(`Could not reach Weno (${cfg.directoryBase}). Confirm your outbound IP is allowlisted in the Weno dashboard. ${String(e?.message || e).slice(0, 120)}`);
  }
  if (r.status === 401 || r.status === 403) throw new WenoError(`Weno rejected the credentials (HTTP ${r.status}). Verify Partner ID + password/MD5 and that this server's IP is allowlisted.`, r.status);
  if (!r.ok) throw new WenoError(`Weno directory request failed (HTTP ${r.status}).`, r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  return { ok: true, bytes: buf.byteLength };
}
