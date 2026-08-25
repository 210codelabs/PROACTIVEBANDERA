import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWenoConfig, buildCancelRxXml, sendSwitch, WenoError } from "@/lib/weno";

export const runtime = "nodejs";

// POST /api/erx/[id]/cancel -> send a CancelRx to the pharmacy via Weno for a
// previously transmitted prescription.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const rx = await db.prescription.findUnique({ where: { id } });
  if (!rx) return NextResponse.json({ error: "Prescription not found" }, { status: 404 });

  if (rx.transmissionMethod !== "weno" || !rx.wenoMessageId || !rx.pharmacyNcpdp) {
    return NextResponse.json({ error: "This prescription was not transmitted via Weno, so there is nothing to cancel." }, { status: 400 });
  }
  if (rx.wenoState === "cancelled") {
    return NextResponse.json({ ok: true, state: "cancelled", statusText: "Already cancelled." });
  }

  const cfg = await getWenoConfig();
  if (!cfg.enabled || !cfg.partnerId || !cfg.md5Password) {
    return NextResponse.json({ error: "Weno is not configured." }, { status: 400 });
  }

  let patient: any = null;
  if (rx.patientId) patient = await db.patient.findUnique({ where: { id: rx.patientId } }).catch(() => null);
  const nameParts = (rx.patientName || "").trim().split(/\s+/);
  const first = patient?.firstName || nameParts.slice(0, -1).join(" ") || nameParts[0] || "";
  const last = patient?.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "") || first;
  const dob = patient?.dob ? new Date(patient.dob).toISOString().slice(0, 10) : (rx.patientDob || "");

  const { xml, messageId } = buildCancelRxXml(cfg, {
    relatesToMessageId: rx.wenoMessageId,
    pharmacyNcpdp: rx.pharmacyNcpdp,
    patient: { first, last, dob, gender: patient?.sex === "M" ? "M" : patient?.sex === "F" ? "F" : "U" },
    prescriberNpi: rx.providerNpi || "",
    prescriberLast: rx.providerName?.split(/\s+/).slice(-1)[0] || rx.providerName || "",
    prescriberFirst: rx.providerName?.split(/\s+/).slice(0, -1).join(" ") || "",
    drugDescription: [rx.medName, rx.strength, rx.form].filter(Boolean).join(" "),
  });

  try {
    const result = await sendSwitch(xml);
    const ok = result.state !== "rejected";
    await db.prescription.update({
      where: { id },
      data: {
        wenoState: ok ? "cancelled" : rx.wenoState, wenoStatusText: result.statusText.slice(0, 300),
        wenoResponse: result.raw.slice(0, 4000), status: ok ? "cancelled" : rx.status,
      },
    });
    await db.auditLog.create({ data: { action: "erx.cancel.weno", resource: "Prescription", resourceId: id, meta: JSON.stringify({ cancelMessageId: messageId, relatesTo: rx.wenoMessageId, state: result.state, by: user.id }) } }).catch(() => {});
    return NextResponse.json({ ok, state: ok ? "cancelled" : result.state, statusText: result.statusText });
  } catch (e: any) {
    const status = e instanceof WenoError ? e.status : undefined;
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: status && status >= 400 && status < 500 ? 400 : 200 });
  }
}
