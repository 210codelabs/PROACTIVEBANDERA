// FMCSA QCMobile API client — carrier lookup by USDOT or MC/docket number.
// Free "web key" required (register at https://mobile.fmcsa.dot.gov/QCDevsite/).
// Key read from env FMCSA_QCMOBILE_KEY (or the integration store if wired later).
// Docs: https://mobile.fmcsa.dot.gov/QCDevsite/docs/apiEndpoints

export type CarrierInfo = {
  dotNumber?: string;
  mcNumber?: string;
  legalName?: string;
  dbaName?: string;
  phyStreet?: string;
  phyCity?: string;
  phyState?: string;
  phyZip?: string;
  allowedToOperate?: string;
  operatingStatus?: string;
  totalDrivers?: number;
  totalPowerUnits?: number;
  raw?: unknown;
};

function getKey(): string | null {
  const k = process.env.FMCSA_QCMOBILE_KEY;
  return k && String(k).trim() ? String(k).trim() : null;
}

export function qcmobileConfigured(): boolean {
  return Boolean(getKey());
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`FMCSA QCMobile returned ${res.status}`);
  return res.json();
}

function mapContent(content: any): CarrierInfo | null {
  // QCMobile wraps results in { content: [{ carrier: {...} }] } or { content: { carrier: {...} } }.
  let carrier: any = null;
  if (Array.isArray(content)) carrier = content[0]?.carrier;
  else if (content?.carrier) carrier = content.carrier;
  else carrier = content;
  if (!carrier) return null;
  return {
    dotNumber: carrier.dotNumber != null ? String(carrier.dotNumber) : undefined,
    legalName: carrier.legalName || undefined,
    dbaName: carrier.dbaName || undefined,
    phyStreet: carrier.phyStreet || undefined,
    phyCity: carrier.phyCity || undefined,
    phyState: carrier.phyState || undefined,
    phyZip: carrier.phyZipcode || carrier.phyZip || undefined,
    allowedToOperate: carrier.allowedToOperate || undefined,
    operatingStatus: carrier.statusCode || carrier.carrierOperation?.carrierOperationDesc || undefined,
    totalDrivers: typeof carrier.totalDrivers === "number" ? carrier.totalDrivers : undefined,
    totalPowerUnits: typeof carrier.totalPowerUnits === "number" ? carrier.totalPowerUnits : undefined,
    raw: carrier,
  };
}

export async function lookupByDot(dot: string): Promise<CarrierInfo | null> {
  const key = getKey();
  if (!key) throw new Error("FMCSA_QCMOBILE_KEY is not configured on this server.");
  const clean = String(dot).replace(/\D/g, "");
  if (!clean) return null;
  const data = await fetchJson(`https://mobile.fmcsa.dot.gov/qc/services/carriers/${clean}?webKey=${encodeURIComponent(key)}`);
  return mapContent(data?.content);
}

export async function lookupByMc(mc: string): Promise<CarrierInfo | null> {
  const key = getKey();
  if (!key) throw new Error("FMCSA_QCMOBILE_KEY is not configured on this server.");
  const clean = String(mc).replace(/\D/g, "");
  if (!clean) return null;
  const data = await fetchJson(`https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${clean}?webKey=${encodeURIComponent(key)}`);
  const info = mapContent(data?.content);
  if (info) info.mcNumber = clean;
  return info;
}
