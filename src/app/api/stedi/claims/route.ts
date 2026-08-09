import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig } from "@/lib/stedi";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const claims = await db.claim.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ claims });
}

function genPCN(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CLM-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// POST create a DRAFT claim from an encounter (superbill) or manual payload.
// body: { encounterId?, payerId?, payerName? }
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getStediConfig();
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let patientId: string | null = null;
  let patientName: string | null = null;
  let diagnoses: { qualifier: string; code: string }[] = [];
  let serviceLines: any[] = [];
  let totalChargeCents = 0;

  if (b.encounterId) {
    const enc = await db.encounter.findUnique({ where: { id: b.encounterId } });
    if (!enc) return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    patientId = enc.patientId;
    const [p, charges, dxs] = await Promise.all([
      db.patient.findUnique({ where: { id: enc.patientId } }).catch(() => null),
      db.encounterCharge.findMany({ where: { encounterId: enc.id } }),
      db.encounterDiagnosis.findMany({ where: { encounterId: enc.id } }),
    ]);
    if (p) patientName = `${p.lastName}, ${p.firstName}`;
    diagnoses = dxs.map((d) => ({ qualifier: "ABK", code: d.icd10 }));
    serviceLines = charges.map((c) => ({ serviceDate: enc.startedAt, procedureCode: c.cpt, chargeCents: c.feeCents, units: c.units || 1, modifier: c.modifier || undefined, diagnosisCodePointers: ["1"] }));
    totalChargeCents = charges.reduce((s, c) => s + c.feeCents * (c.units || 1), 0);
  } else {
    patientId = b.patientId || null;
    patientName = b.patientName || null;
    diagnoses = Array.isArray(b.diagnoses) ? b.diagnoses : [];
    serviceLines = Array.isArray(b.serviceLines) ? b.serviceLines : [];
    totalChargeCents = serviceLines.reduce((s: number, l: any) => s + (l.chargeCents || 0) * (l.units || 1), 0);
  }

  const claim = await db.claim.create({
    data: {
      patientControlNumber: genPCN(),
      patientId, patientName,
      encounterId: b.encounterId || null,
      payerId: (b.payerId || cfg.defaultPayerId || "").trim(),
      payerName: b.payerName || null,
      status: "draft",
      totalChargeCents,
      diagnoses: diagnoses as object,
      serviceLines: serviceLines as object,
      createdById: user.id,
      createdByName: `${user.firstName} ${user.lastName}`,
    },
  });

  // Payment posting — record the charge on the patient ledger (idempotent).
  if (claim.patientId && claim.totalChargeCents > 0) {
    await db.patientLedgerEntry
      .create({
        data: {
          patientId: claim.patientId,
          type: "charge",
          amountCents: claim.totalChargeCents,
          description: `Charge — claim ${claim.patientControlNumber}`,
          claimId: claim.id,
          refKey: `charge:${claim.id}`,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true, claim });
}
