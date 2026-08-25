import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public server-to-server callback for WENO ONLINE (ComposeRx / EZ Integration)
// asynchronous status/result messages. Weno posts to the endpoint you register
// in the Weno dashboard (Manage Account -> Manage IPs and Endpoints). It
// correlates back to the Rx-history stub created at launch time via our
// OrgTransactionID (falls back to OrgPatientID), then records the drug + final
// delivery status so ComposeRx-launched prescriptions report into Rx history.
//
// Weno's exact EZ status schema is not publicly fixed, so parsing is defensive:
// JSON, form-encoded, and XML payloads are all accepted, and field names are
// matched heuristically.

type Extracted = {
  txId?: string;
  orgPatientId?: string;
  status?: string;
  statusText?: string;
  drug?: string;
  ncpdp?: string;
  pharmacyName?: string;
};

function pick(obj: Record<string, any>, keys: string[]): string | undefined {
  for (const k of Object.keys(obj)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const want of keys) {
      if (norm === want) {
        const v = obj[k];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return undefined;
}

function fromXml(raw: string, tags: string[]): string | undefined {
  for (const t of tags) {
    const m = raw.match(new RegExp(`<${t}>([^<]+)</${t}>`, "i"));
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

async function extract(req: Request): Promise<{ raw: string; data: Extracted }> {
  const ctype = (req.headers.get("content-type") || "").toLowerCase();
  const raw = await req.text().catch(() => "");
  let obj: Record<string, any> = {};

  if (ctype.includes("application/json")) {
    try { obj = JSON.parse(raw) || {}; } catch { obj = {}; }
    // flatten one level of nesting (e.g. { message: {...} })
    if (obj && typeof obj === "object") {
      for (const v of Object.values(obj)) {
        if (v && typeof v === "object" && !Array.isArray(v)) obj = { ...v, ...obj };
      }
    }
  } else if (ctype.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(raw);
    obj = Object.fromEntries(p.entries());
  } else if (raw.trim().startsWith("{")) {
    try { obj = JSON.parse(raw) || {}; } catch { obj = {}; }
  }

  const data: Extracted = {
    txId:
      pick(obj, ["orgtransactionid", "transactionid", "messageid", "orgrxid", "rxid"]) ||
      fromXml(raw, ["OrgTransactionID", "TransactionID", "MessageID", "OrgRxID"]),
    orgPatientId:
      pick(obj, ["orgpatientid", "patientid"]) || fromXml(raw, ["OrgPatientID", "PatientID"]),
    status:
      pick(obj, ["status", "messagestatus", "statuscode", "state", "rxstatus"]) ||
      fromXml(raw, ["Status", "MessageStatus", "StatusCode", "State"]),
    statusText:
      pick(obj, ["description", "statustext", "message", "detail", "reason"]) ||
      fromXml(raw, ["Description", "StatusText", "Detail", "Reason"]),
    drug:
      pick(obj, ["drugdescription", "drug", "medication", "medicationname", "drugname"]) ||
      fromXml(raw, ["DrugDescription", "Drug", "MedicationName"]),
    ncpdp:
      pick(obj, ["ncpdpid", "ncpdp", "pharmacyncpdp", "pharmacyncpcp"]) ||
      fromXml(raw, ["NCPDPID", "NCPDP", "PharmacyNCPDP"]),
    pharmacyName:
      pick(obj, ["pharmacyname", "pharmacy"]) || fromXml(raw, ["PharmacyName", "Pharmacy"]),
  };
  return { raw, data };
}

// Map any vendor status text to our internal Weno state vocabulary.
function mapState(status?: string, statusText?: string): string {
  const s = `${status || ""} ${statusText || ""}`.toLowerCase();
  if (/reject|deny|denied|fail|error/.test(s)) return "rejected";
  if (/cancel/.test(s)) return "cancelled";
  if (/deliver|dispens|filled|complete|accept|success|received|sent to pharmacy/.test(s)) return "delivered";
  if (/pending|process|queue|transmit|submit/.test(s)) return "submitted";
  return "submitted";
}

export async function POST(req: Request) {
  const { raw, data } = await extract(req);
  try {
    const state = mapState(data.status, data.statusText);
    const statusText = (data.statusText || data.status || "Weno Online status update").slice(0, 300);
    const dbStatus = state === "rejected" || state === "error" ? "transmit_error" : "transmitted";

    const detailPatch: Record<string, any> = {
      wenoState: state,
      wenoStatusText: statusText,
      wenoResponse: raw.slice(0, 4000),
      status: dbStatus,
      transmittedAt: new Date(),
    };
    if (data.drug) detailPatch.medName = data.drug.slice(0, 200);
    if (data.ncpdp) detailPatch.pharmacyNcpdp = data.ncpdp;
    if (data.pharmacyName) detailPatch.pharmacyName = data.pharmacyName.slice(0, 200);

    let matched = false;

    // 1) Correlate by our OrgTransactionID (stored as wenoMessageId at launch).
    if (data.txId) {
      const r = await db.prescription.updateMany({
        where: { wenoMessageId: data.txId, transmissionMethod: "weno-online" },
        data: detailPatch,
      });
      matched = r.count > 0;
    }

    // 2) Fallback: newest open Weno-Online stub for that patient.
    if (!matched && data.orgPatientId) {
      const stub = await db.prescription.findFirst({
        where: {
          patientId: data.orgPatientId,
          transmissionMethod: "weno-online",
          wenoState: { in: ["launched", "submitted"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (stub) {
        await db.prescription.update({ where: { id: stub.id }, data: detailPatch });
        matched = true;
      }
    }

    // 3) Nothing to correlate to — record a standalone entry so the result is
    //    never silently lost.
    if (!matched) {
      await db.prescription.create({
        data: {
          patientId: data.orgPatientId || null,
          patientName: "(Weno Online)",
          medName: data.drug ? data.drug.slice(0, 200) : "Weno Online prescription",
          providerName: "Weno Online",
          transmissionMethod: "weno-online",
          pharmacyNcpdp: data.ncpdp || null,
          pharmacyName: data.pharmacyName || null,
          wenoMessageId: data.txId || null,
          wenoState: state,
          wenoStatusText: statusText,
          wenoResponse: raw.slice(0, 4000),
          status: dbStatus,
          transmittedAt: new Date(),
        },
      });
    }
  } catch {
    /* never fail the ack — Weno should not retry endlessly on our error */
  }
  return NextResponse.json({ ok: true });
}
