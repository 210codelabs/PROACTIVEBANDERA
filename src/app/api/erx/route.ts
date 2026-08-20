import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  patientId: z.string().optional().nullable(),
  patientName: z.string().min(1),
  patientDob: z.string().optional().nullable(),
  patientAddress: z.string().optional().nullable(),
  medName: z.string().min(1),
  strength: z.string().optional().nullable(),
  form: z.string().optional().nullable(),
  ndc: z.string().optional().nullable(),
  sig: z.string().optional().nullable(),
  quantity: z.string().optional().nullable(),
  refills: z.number().int().min(0).max(99).optional(),
  daw: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  pharmacyName: z.string().optional().nullable(),
  pharmacyAddress: z.string().optional().nullable(),
  pharmacyNpi: z.string().optional().nullable(),
  pharmacyPhone: z.string().optional().nullable(),
  providerName: z.string().min(1),
  providerNpi: z.string().optional().nullable(),
  signatureType: z.enum(["typed", "drawn"]).optional().nullable(),
  signatureData: z.string().optional().nullable(),
});

// GET /api/erx -> recent prescriptions
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const items = await db.prescription.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);
  return NextResponse.json({ prescriptions: items });
}

// POST /api/erx -> create + e-sign a prescription
export async function POST(req: Request) {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const json = await req.json().catch(() => null);
  const parse = Body.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: parse.error.issues[0]?.message || "Invalid prescription." }, { status: 400 });
  const b = parse.data;
  try {
    const rx = await db.prescription.create({
      data: {
        patientId: b.patientId || null, patientName: b.patientName, patientDob: b.patientDob || null, patientAddress: b.patientAddress || null,
        medName: b.medName, strength: b.strength || null, form: b.form || null, ndc: b.ndc || null,
        sig: b.sig || null, quantity: b.quantity || null, refills: b.refills ?? 0, daw: b.daw ?? false, notes: b.notes || null,
        pharmacyName: b.pharmacyName || null, pharmacyAddress: b.pharmacyAddress || null, pharmacyNpi: b.pharmacyNpi || null, pharmacyPhone: b.pharmacyPhone || null,
        providerName: b.providerName, providerNpi: b.providerNpi || null, providerId: user.id,
        signatureType: b.signatureType || null, signatureData: b.signatureData || null,
        status: "signed",
      },
    });
    // Also record to the Rx orders queue when tied to a patient (best-effort).
    if (b.patientId) {
      await db.order.create({ data: { patientId: b.patientId, providerId: user.id, type: "rx", status: "sent", itemName: b.medName, rxStrength: b.strength || null, rxForm: b.form || null, rxSig: b.sig || null, rxQty: b.quantity || null, rxRefills: b.refills ?? 0, pharmacyName: b.pharmacyName || null, routingNetwork: "internal" } }).catch(() => {});
    }
    return NextResponse.json({ ok: true, id: rx.id });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not save prescription: ${String(e?.message || e).slice(0, 160)}` }, { status: 500 });
  }
}
