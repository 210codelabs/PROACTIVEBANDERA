import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWenoConfig, buildNewRxXml, sendSwitch, WenoError } from "@/lib/weno";

export const runtime = "nodejs";

const Body = z.object({ pharmacyNcpdp: z.string().optional().nullable() });

// POST /api/erx/[id]/transmit -> transmit a signed prescription to the pharmacy
// via Weno Exchange (Switch NewRx). Read-only w.r.t. clinical content; records
// transmission status on the Prescription.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const rx = await db.prescription.findUnique({ where: { id } });
  if (!rx) return NextResponse.json({ error: "Prescription not found" }, { status: 404 });

  const cfg = await getWenoConfig();
  if (!cfg.enabled) return NextResponse.json({ error: "Weno Exchange is not enabled. Turn it on in Admin → External Integrations." }, { status: 400 });
  if (!cfg.partnerId || !cfg.md5Password) return NextResponse.json({ error: "Weno credentials are not configured yet. Add your Partner ID + password in Admin → Integrations." }, { status: 400 });

  const body = Body.safeParse(await req.json().catch(() => ({})));
  const ncpdp = (body.success ? body.data.pharmacyNcpdp : "") || rx.pharmacyNcpdp || rx.pharmacyNpi || "";
  if (!ncpdp) return NextResponse.json({ error: "A pharmacy NCPDP ID is required to transmit. Select a Weno/Surescripts pharmacy or enter its NCPDP ID." }, { status: 400 });

  // Controlled-substance guard: block EPCS unless explicitly enabled (and even
  // then it is NOT certified until Weno approves the DEA audit).
  const isControlled = Boolean(rx.deaSchedule && /C-?(II|III|IV|V|2|3|4|5)/i.test(rx.deaSchedule));
  if (isControlled && !cfg.epcsEnabled) {
    return NextResponse.json({ error: "This is a controlled substance. Enable the EPCS sub-service on Weno (requires Weno DEA-audit approval) before transmitting." }, { status: 400 });
  }

  // Enrich patient demographics from the chart when available.
  let patient: any = null;
  if (rx.patientId) patient = await db.patient.findUnique({ where: { id: rx.patientId } }).catch(() => null);
  const nameParts = (rx.patientName || "").trim().split(/\s+/);
  const first = patient?.firstName || nameParts.slice(0, -1).join(" ") || nameParts[0] || "";
  const last = patient?.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "") || first;
  const dob = patient?.dob ? new Date(patient.dob).toISOString().slice(0, 10) : (rx.patientDob || "");

  const { xml, messageId } = buildNewRxXml(cfg, {
    patient: {
      first, last,
      dob,
      gender: patient?.sex === "M" ? "M" : patient?.sex === "F" ? "F" : "U",
      address1: patient?.addressLine1 || (rx.patientAddress || ""),
      city: patient?.city || "", state: patient?.state || "", zip: patient?.postalCode || "",
    },
    pharmacyNcpdp: ncpdp,
    drugDescription: [rx.medName, rx.strength, rx.form].filter(Boolean).join(" "),
    ndc: rx.ndc || undefined,
    drugCode: rx.ndc || "",
    drugQualifier: rx.ndc ? "ND" : "SBD",
    deaSchedule: rx.deaSchedule ? rx.deaSchedule.replace(/[^0-9IVX]/gi, "") || "0" : "0",
    quantity: rx.quantity || "1",
    daysSupply: "30",
    refills: String(rx.refills ?? 0),
    sig: rx.sig || "",
    prescriberNpi: rx.providerNpi || "",
    prescriberLast: rx.providerName?.split(/\s+/).slice(-1)[0] || rx.providerName || "",
    prescriberFirst: rx.providerName?.split(/\s+/).slice(0, -1).join(" ") || "",
  } as any);

  try {
    const result = await sendSwitch(xml);
    await db.prescription.update({
      where: { id },
      data: {
        transmissionMethod: "weno", pharmacyNcpdp: ncpdp, wenoMessageId: messageId,
        wenoState: result.state, wenoStatusText: result.statusText, wenoResponse: result.raw.slice(0, 4000),
        transmittedAt: new Date(), status: result.state === "rejected" ? "transmit_error" : "transmitted",
      },
    });
    await db.auditLog.create({ data: { action: "erx.transmit.weno", resource: "Prescription", resourceId: id, meta: JSON.stringify({ messageId, state: result.state, ncpdp, by: user.id }) } }).catch(() => {});
    return NextResponse.json({ ok: result.state !== "rejected", messageId, state: result.state, statusText: result.statusText });
  } catch (e: any) {
    const status = e instanceof WenoError ? e.status : undefined;
    await db.prescription.update({ where: { id }, data: { transmissionMethod: "weno", pharmacyNcpdp: ncpdp, wenoMessageId: messageId, wenoState: "error", wenoStatusText: String(e?.message || e).slice(0, 300), transmittedAt: new Date(), status: "transmit_error" } }).catch(() => {});
    return NextResponse.json({ ok: false, state: "error", error: String(e?.message || e).slice(0, 300) }, { status: status && status >= 400 && status < 500 ? 400 : 200 });
  }
}
