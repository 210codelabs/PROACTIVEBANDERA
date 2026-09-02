import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { readAdminConfig } from "@/lib/admin/store";
import { buildPtPdf, sanitize, fmtDate } from "@/lib/pt/notePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const note = await db.ptNote.findUnique({ where: { id } });
  if (!note) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  const patient = await db.patient.findUnique({ where: { id: note.patientId } });
  const cfg = await readAdminConfig().catch(() => null);

  const bytes = await buildPtPdf({
    patient: patient ? { firstName: patient.firstName, lastName: patient.lastName, mrn: patient.mrn, dob: patient.dob } : null,
    notes: [note as any],
    org: cfg?.org?.orgName || cfg?.branding?.appName || "Proactive Clinic Health",
    legal: cfg?.org?.legalName || "",
    website: cfg?.org?.website || "",
    logoRel: cfg?.branding?.logoUrl || "/pclinic-light.png",
    mode: "single",
  });

  const pname = patient ? `${patient.lastName}, ${patient.firstName}` : "Unknown";
  const safeName = sanitize(pname).replace(/[^a-zA-Z0-9]+/g, "_");
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="PI_PT_Note_${safeName}_${fmtDate(note.visitDate).replace(/[^a-zA-Z0-9]+/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
