import crypto from "crypto";

// CMS Blue Button 2.0 (Medicare) OAuth 2.0 + PKCE connector.
// Patient-authorized only. Env-switchable between sandbox and production.

export type BbConfig = {
  env: string;
  host: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  configured: boolean;
};

export function bbConfig(): BbConfig {
  const env = (process.env.CMS_BB_ENV || "sandbox").toLowerCase();
  const host = env === "production" ? "https://api.bluebutton.cms.gov" : "https://sandbox.bluebutton.cms.gov";
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  return {
    env,
    host,
    clientId: process.env.CMS_CLIENT_ID || "",
    clientSecret: process.env.CMS_CLIENT_SECRET || "",
    redirectUri: process.env.CMS_REDIRECT_URI || `${base}/api/cms/callback`,
    authorizeUrl: `${host}/v2/o/authorize`,
    tokenUrl: `${host}/v2/o/token`,
    scopes: ["patient/Patient.read", "patient/ExplanationOfBenefit.read", "patient/Coverage.read", "profile"],
    configured: Boolean(process.env.CMS_CLIENT_ID && process.env.CMS_CLIENT_SECRET),
  };
}

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  return `${base}${path}`;
}

export function pkce() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomState() {
  return crypto.randomBytes(16).toString("base64url");
}

export function authorizeRedirect(cfg: BbConfig, state: string, challenge: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${cfg.authorizeUrl}?${p.toString()}`;
}

export async function exchangeToken(cfg: BbConfig, code: string, verifier: string): Promise<any> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
    client_id: cfg.clientId,
  });
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const r = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`token_exchange ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function fhir(cfg: BbConfig, token: string, path: string): Promise<any | null> {
  try {
    const r = await fetch(`${cfg.host}/v2/fhir/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function summarizeCoverage(bundle: any) {
  const entries = bundle?.entry || [];
  return entries
    .map((e: any) => {
      const c = e.resource || {};
      return {
        type: c.type?.coding?.[0]?.display || c.type?.text || c.class?.[0]?.value || "Coverage",
        status: c.status || "",
        period: c.period ? `${c.period.start || ""}${c.period.end ? " – " + c.period.end : ""}` : "",
        payor: c.payor?.[0]?.display || "",
      };
    })
    .slice(0, 12);
}

function summarizeEob(bundle: any) {
  const entries = bundle?.entry || [];
  return entries
    .map((e: any) => {
      const r = e.resource || {};
      const totalVal = (r.total || []).map((t: any) => t?.amount?.value).find((v: any) => typeof v === "number");
      return {
        id: r.id || "",
        type: r.type?.coding?.[0]?.display || r.type?.text || r.type?.coding?.[0]?.code || "Claim",
        date: r.billablePeriod?.start || r.created || "",
        provider: r.provider?.display || "",
        total: typeof totalVal === "number" ? totalVal : null,
      };
    })
    .slice(0, 30);
}

export async function fetchPatientData(cfg: BbConfig, token: string, bbPatientId: string) {
  const [patient, coverageBundle, eobBundle] = await Promise.all([
    bbPatientId ? fhir(cfg, token, `Patient/${bbPatientId}`) : Promise.resolve(null),
    fhir(cfg, token, `Coverage?beneficiary=${bbPatientId}&_count=20`),
    fhir(cfg, token, `ExplanationOfBenefit?patient=${bbPatientId}&_count=30`),
  ]);
  return {
    patient,
    coverage: summarizeCoverage(coverageBundle),
    claims: summarizeEob(eobBundle),
  };
}
