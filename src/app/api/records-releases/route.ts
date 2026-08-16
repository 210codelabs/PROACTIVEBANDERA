import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/records-releases
// Unified "records released" history for staff: attorney downloads (records.release)
// + admin EHI exports (ehi.export), enriched with actor / chart / format / time.
export async function GET() {
  let user: any;
  try { user = await requireSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await db.auditLog.findMany({
    where: { action: { in: ["records.release", "ehi.export"] } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const userIds = new Set<string>();
  const patientIds = new Set<string>();
  const mrns = new Set<string>();
  const attorneyIds = new Set<string>();

  const parsed = logs.map((l) => {
    let meta: any = {};
    try { meta = l.meta ? JSON.parse(l.meta) : {}; } catch { meta = {}; }
    if (l.userId) userIds.add(l.userId);
    if (l.action === "ehi.export") {
      if (l.resourceId && l.resourceId !== "all") patientIds.add(l.resourceId);
    } else {
      if (meta.mrn) mrns.add(String(meta.mrn));
      if (meta.attorneyId) attorneyIds.add(String(meta.attorneyId));
    }
    return { l, meta };
  });

  const [users, patientsById, patientsByMrn, attorneys] = await Promise.all([
    userIds.size ? db.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, firstName: true, lastName: true, email: true } }) : Promise.resolve([]),
    patientIds.size ? db.patient.findMany({ where: { id: { in: [...patientIds] } }, select: { id: true, firstName: true, lastName: true, mrn: true } }) : Promise.resolve([]),
    mrns.size ? db.patient.findMany({ where: { mrn: { in: [...mrns] } }, select: { id: true, firstName: true, lastName: true, mrn: true } }) : Promise.resolve([]),
    attorneyIds.size ? db.attorney.findMany({ where: { id: { in: [...attorneyIds] } }, select: { id: true, name: true, firm: true, email: true } }).catch(() => []) : Promise.resolve([]),
  ]);

  const uMap = new Map(users.map((u: any) => [u.id, u]));
  const pIdMap = new Map(patientsById.map((p: any) => [p.id, p]));
  const pMrnMap = new Map(patientsByMrn.map((p: any) => [p.mrn, p]));
  const aMap = new Map((attorneys as any[]).map((a: any) => [a.id, a]));

  const fmtLabel = (f?: string) => {
    const s = String(f || "").toLowerCase();
    if (s === "pdf") return "Summary PDF";
    if (s === "ccda") return "C-CDA (XML)";
    if (s === "ndjson") return "FHIR NDJSON";
    if (s === "zip") return "FHIR bundle (ZIP)";
    if (s === "pdf-batch") return "Batch PDFs (ZIP)";
    if (s === "ccda-batch") return "Batch C-CDA (ZIP)";
    return f || "—";
  };

  const releases = parsed.map(({ l, meta }) => {
    if (l.action === "records.release") {
      const att = meta.attorneyId ? aMap.get(String(meta.attorneyId)) : null;
      const p = meta.mrn ? pMrnMap.get(String(meta.mrn)) : null;
      return {
        id: l.id,
        at: l.createdAt,
        channel: "Attorney portal",
        actor: att ? (att.name || att.email) : (meta.attorney || "Attorney"),
        actorDetail: att?.firm || meta.attorney || "",
        chart: p ? `${p.lastName}, ${p.firstName}` : (meta.patientLastName || "—"),
        mrn: meta.mrn || (p?.mrn ?? "—"),
        format: fmtLabel(meta.format),
      };
    }
    // ehi.export (staff)
    const u = l.userId ? uMap.get(l.userId) : null;
    const isAll = !l.resourceId || l.resourceId === "all";
    const p = !isAll ? pIdMap.get(l.resourceId!) : null;
    return {
      id: l.id,
      at: l.createdAt,
      channel: "Staff export",
      actor: u ? `${u.firstName} ${u.lastName}` : "Staff",
      actorDetail: u?.email || "",
      chart: isAll ? `All patients${meta.patientCount ? ` (${meta.patientCount})` : ""}` : (p ? `${p.lastName}, ${p.firstName}` : "—"),
      mrn: isAll ? "—" : (p?.mrn ?? "—"),
      format: fmtLabel(meta.format),
    };
  });

  return NextResponse.json({ releases });
}
