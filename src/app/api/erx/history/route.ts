import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/erx/history?patientId=...
// READ-ONLY e-prescription history for one patient, shown under the embedded
// Weno EZ Integration (ComposeRx) on the E-Prescribe screen. Merges:
//   - prescriptions recorded in the EHR (Weno EZ launches / legacy signed Rx)
//   - prescriptions imported from Weno's NewRx Sync Report (Medication source=weno)
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const patientId = new URL(req.url).searchParams.get("patientId")?.trim() || "";
  if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

  try {
    const [rxs, meds] = await Promise.all([
      db.prescription.findMany({ where: { patientId }, orderBy: { createdAt: "desc" }, take: 100 }).catch(() => [] as any[]),
      db.medication.findMany({ where: { patientId, source: "weno" }, orderBy: { createdAt: "desc" }, take: 100 }).catch(() => [] as any[]),
    ]);

    const items = [
      ...rxs.map((r: any) => ({
        id: `rx_${r.id}`,
        kind: "prescription",
        source: r.transmissionMethod === "weno" || r.transmissionMethod === "weno-online" ? "Weno EZ" : "EHR",
        medName: r.medName || "",
        strength: r.strength || "",
        sig: r.sig || "",
        quantity: r.quantity || "",
        refills: r.refills ?? 0,
        deaSchedule: r.deaSchedule || null,
        pharmacyName: r.pharmacyName || "",
        prescriber: r.providerName || "",
        status: r.wenoState || r.status || "signed",
        date: (r.createdAt as Date)?.toISOString?.() || null,
      })),
      ...meds.map((m: any) => ({
        id: `med_${m.id}`,
        kind: "weno-sync",
        source: "Weno EZ",
        medName: m.name || "",
        strength: m.strength || "",
        sig: m.sig || "",
        quantity: "",
        refills: null,
        deaSchedule: null,
        pharmacyName: "",
        prescriber: "",
        status: (String(m.notes || "").split("·")[1] || "sent").trim(),
        date: ((m.startDate || m.createdAt) as Date)?.toISOString?.() || null,
      })),
    ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return NextResponse.json({ patientId, count: items.length, items });
  } catch (e: any) {
    return NextResponse.json({ error: "Could not load prescription history." }, { status: 500 });
  }
}
