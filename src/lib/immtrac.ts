// Texas ImmTrac2 (state Immunization Information System) connector.
// EZ-style on-demand query: build HL7 v2.5.1 QBP^Q11, send over the CDC SOAP
// WSDL, parse the RSP^K11 response into chart-ready immunizations.
//
// NOTE: This is env-driven and stays INACTIVE until DSHS issues the clinic its
// TEST credentials + WSDL (isImmtracConfigured() returns false without them).
// No PHI or raw HL7 is logged/persisted.

export type ImmtracConfig = {
  wsdlUrl: string;
  soapUrl: string;
  username: string;
  password: string;
  facilityId: string;
  senderId: string;
  senderFacility: string;
  receiverId: string;
  receiverFacility: string;
  environment: "test" | "production";
  soapOperation: string; // WSDL operation name (CDC default: submitSingleMessage)
};

export function getImmtracConfig(): ImmtracConfig {
  return {
    wsdlUrl: process.env.IMMTRAC_WSDL_URL || "",
    soapUrl: process.env.IMMTRAC_SOAP_URL || "",
    username: process.env.IMMTRAC_USERNAME || "",
    password: process.env.IMMTRAC_PASSWORD || "",
    facilityId: process.env.IMMTRAC_FACILITY_ID || "",
    senderId: process.env.IMMTRAC_SENDER_ID || "",
    senderFacility: process.env.IMMTRAC_SENDER_FACILITY || "",
    receiverId: process.env.IMMTRAC_RECEIVER_ID || "TXIIS",
    receiverFacility: process.env.IMMTRAC_RECEIVER_FACILITY || "TXIIS",
    environment: (process.env.IMMTRAC_ENV as "test" | "production") || "test",
    soapOperation: process.env.IMMTRAC_SOAP_OPERATION || "submitSingleMessage",
  };
}

// A live query needs the WSDL/endpoint + credentials + org id + sender id.
export function isImmtracConfigured(c: ImmtracConfig = getImmtracConfig()): boolean {
  return Boolean(
    (c.wsdlUrl || c.soapUrl) && c.username && c.password && c.facilityId && c.senderId
  );
}

// ---- HL7 v2.5.1 helpers -----------------------------------------------------

function hl7Escape(v: string): string {
  return String(v || "")
    .replace(/\\/g, "\\E\\")
    .replace(/\|/g, "\\F\\")
    .replace(/\^/g, "\\S\\")
    .replace(/~/g, "\\R\\")
    .replace(/&/g, "\\T\\");
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

export type QueryPatient = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  sex?: string | null; // M | F | U
  phone?: string | null;
};

function dobDigits(dob: string): string {
  return (dob || "").replace(/\D/g, "").slice(0, 8);
}

function sexCode(sex?: string | null): string {
  const s = (sex || "").toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "U";
}

// Build a QBP^Q11 immunization-history query (Texas Z34 profile).
export function buildQbpQ11(p: QueryPatient, queryId: string, c: ImmtracConfig = getImmtracConfig()): string {
  const ts = stamp();
  const msh = [
    "MSH",
    "^~\\&",
    c.senderId,
    c.senderFacility || c.facilityId,
    c.receiverId,
    c.receiverFacility,
    ts,
    "",
    "QBP^Q11^QBP_Q11",
    queryId,
    c.environment === "production" ? "P" : "T",
    "2.5.1",
    "", "", "", "", "", "", "", "",
    "Z34^CDCPHINVS",
  ].join("|");

  // QPD: PatientList search — name, dob, sex, phone
  const qpd = [
    "QPD",
    "Z34^Request Immunization History^HL70471",
    queryId,
    `${hl7Escape(p.lastName)}^${hl7Escape(p.firstName)}^^^^^L`,
    dobDigits(p.dob),
    sexCode(p.sex),
    "", "", "", "",
    p.phone ? `^PRN^PH^^^${hl7Escape(p.phone.replace(/\D/g, ""))}` : "",
  ].join("|");

  // RCP: return up to 25 records, immediate
  const rcp = ["RCP", "I", "25^RD"].join("|");

  return [msh, qpd, rcp].join("\r") + "\r";
}

// ---- CVX (common vaccine) lookup -------------------------------------------

const CVX: Record<string, string> = {
  "03": "MMR", "08": "Hep B, adolescent/pediatric", "10": "IPV (Polio)",
  "20": "DTaP", "21": "Varicella", "43": "Hep B, adult", "62": "HPV, quadrivalent",
  "83": "Hep A, pediatric/adolescent", "88": "Influenza", "94": "MMRV",
  "110": "DTaP-Hep B-IPV", "115": "Tdap", "116": "Rotavirus, pentavalent",
  "120": "DTaP-Hib-IPV", "133": "Pneumococcal conjugate PCV13", "140": "Influenza, seasonal, injectable",
  "141": "Influenza, seasonal, injectable", "150": "Influenza, injectable, quadrivalent",
  "148": "Meningococcal C/Y-HIB PRP", "158": "Influenza, injectable, quadrivalent",
  "161": "Influenza, injectable, quadrivalent", "197": "Influenza, high-dose seasonal",
  "207": "COVID-19 mRNA (Moderna)", "208": "COVID-19 mRNA (Pfizer)", "212": "COVID-19 (J&J)",
  "213": "COVID-19, unspecified", "218": "COVID-19 (Pfizer peds)", "219": "COVID-19 (Pfizer peds)",
  "300": "COVID-19 (Pfizer 2023-2024)", "301": "COVID-19 (Moderna 2023-2024)",
  "115x": "Tdap", "49": "Hib (PRP-OMP)", "48": "Hib (PRP-T)", "114": "Meningococcal MCV4P",
  "136": "Meningococcal MCV4O", "33": "Pneumococcal polysaccharide PPSV23", "187": "Zoster recombinant (Shingrix)",
};

function cvxName(code: string, fallback: string): string {
  return CVX[code] || fallback || (code ? `CVX ${code}` : "Vaccine");
}

// ---- RSP^K11 parsing --------------------------------------------------------

export type ParsedImmunization = {
  vaccine: string;
  cvxCode: string | null;
  givenAt: string | null; // ISO date
  lot: string | null;
  site: string | null;
  route: string | null;
  manufacturer: string | null;
  doseNumber: string | null;
  sourceKey: string;
};

export type ParsedRsp = {
  matchType: string | null; // Z32 exact | Z31 multiple | Z33 | Z34 none
  ackOk: boolean;
  candidateCount: number;
  immunizations: ParsedImmunization[];
};

function seg(fields: string[], i: number): string {
  return fields[i] ?? "";
}
function comp(field: string, i: number): string {
  return (field || "").split("^")[i] ?? "";
}
function toIso(yyyymmdd: string): string | null {
  const d = (yyyymmdd || "").replace(/\D/g, "").slice(0, 8);
  if (d.length < 8) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export function parseRspK11(raw: string): ParsedRsp {
  const segments = String(raw || "")
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split("\r")
    .map((s) => s.trim())
    .filter(Boolean);

  let ackOk = false;
  let matchType: string | null = null;
  let candidateCount = 0;
  const imms: ParsedImmunization[] = [];
  let current: ParsedImmunization | null = null;

  for (const line of segments) {
    const f = line.split("|");
    const name = f[0];

    if (name === "MSA") {
      ackOk = seg(f, 1).toUpperCase().startsWith("AA");
    } else if (name === "QAK") {
      // QAK-2: OK (data found) | NF (no data) | AE (error). QAK-5 may carry profile.
      const status = seg(f, 2).toUpperCase();
      const profile = comp(seg(f, 5), 0) || comp(seg(f, 1), 0);
      if (profile) matchType = profile;
      if (status === "NF") matchType = matchType || "Z34";
    } else if (name === "PID") {
      candidateCount += 1;
    } else if (name === "RXA") {
      if (current) imms.push(current);
      const adminCode = seg(f, 5); // CVX^name^CVX
      const cvxCode = comp(adminCode, 0) || null;
      const givenAt = toIso(seg(f, 3));
      const lot = seg(f, 15) || null;
      const mvx = seg(f, 17);
      const manufacturer = comp(mvx, 1) || comp(mvx, 0) || null;
      current = {
        cvxCode,
        vaccine: cvxName(cvxCode || "", comp(adminCode, 1)),
        givenAt,
        lot,
        manufacturer,
        route: null,
        site: null,
        doseNumber: null,
        sourceKey: `${cvxCode || "?"}|${givenAt || "?"}`,
      };
    } else if (name === "RXR" && current) {
      current.route = comp(seg(f, 1), 1) || comp(seg(f, 1), 0) || null;
      current.site = comp(seg(f, 2), 1) || comp(seg(f, 2), 0) || null;
    } else if (name === "OBX" && current) {
      // dose number (30973-2) or similar
      const obsId = comp(seg(f, 3), 1).toLowerCase();
      if (obsId.includes("dose number")) current.doseNumber = seg(f, 5) || current.doseNumber;
    }
  }
  if (current) imms.push(current);

  // Determine match type from candidate count if not explicit
  if (!matchType) {
    if (candidateCount > 1) matchType = "Z31";
    else if (imms.length > 0 || candidateCount === 1) matchType = "Z32";
    else matchType = "Z34";
  }

  return { matchType, ackOk, candidateCount, immunizations: imms };
}

// ---- SOAP transport ---------------------------------------------------------

// Sends the HL7 message via the CDC/ImmTrac2 SOAP WSDL and returns the raw HL7
// response string. Operation + argument shape follow the CDC standard
// (submitSingleMessage) but are adjustable via env once DSHS supplies the WSDL.
export async function queryImmtrac(hl7: string, c: ImmtracConfig = getImmtracConfig()): Promise<string> {
  if (!isImmtracConfigured(c)) throw new Error("ImmTrac2 is not configured");
  // Lazy import so the app builds/runs even where soap isn't needed.
  const soap = await import("soap");
  const client = await soap.createClientAsync(c.wsdlUrl, c.soapUrl ? { endpoint: c.soapUrl } : {});
  const args: Record<string, string> = {
    username: c.username,
    password: c.password,
    facilityID: c.facilityId,
    hl7Message: hl7,
  };
  const fn = (client as any)[`${c.soapOperation}Async`];
  if (typeof fn !== "function") {
    throw new Error(`SOAP operation '${c.soapOperation}' not found on WSDL`);
  }
  const [result] = await fn.call(client, args);
  const out =
    result?.return ||
    result?.HL7Message ||
    result?.hl7Message ||
    result?.[`${c.soapOperation}Return`] ||
    result;
  if (typeof out !== "string") throw new Error("ImmTrac2 returned no HL7 message");
  return out;
}
