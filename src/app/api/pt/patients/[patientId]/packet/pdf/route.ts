import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { readAdminConfig } from "@/lib/admin/store";
import { buildPtPdf, sanitize } from "@/lib/pt/notePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pt/patients/[patientId]/packet/pdf
// Bundles the patient's SIGNED PI notes + latest PI intake into one attorney/insurer packet.
export async function GET(_req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  await requireSession();
  const { patientId } = await params;

  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) return new Response(JSON.stringify({ error: "Patient not found" }), { status: 404 });

  const notes = await db.ptNote.findMany({
    where: { patientId, status: "signed" },
    orderBy: { visitDate: "asc" },
  });
  if (!notes.length) {
    return new Response(JSON.stringify({ error: "No signed PI notes for this patient yet." }), { status: 400 });
  }
  const intake = await db.piIntake.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" } }).catch(() => null);
  const cfg = await readAdminConfig().catch(() => null);

  const bytes = await buildPtPdf({
    patient: { firstName: patient.firstName, lastName: patient.lastName, mrn: patient.mrn, dob: patient.dob },
    notes: notes as any[],
    intake: intake as any,
    org: cfg?.org?.orgName || cfg?.branding?.appName || "Proactive Clinic Health",
    legal: cfg?.org?.legalName || "",
    website: cfg?.org?.website || "",
    logoRel: cfg?.branding?.logoUrl || "/pclinic-light.png",
    mode: "packet",
  });

  const safeName = sanitize(`${patient.lastName}_${patient.firstName}`).replace(/[^a-zA-Z0-9]+/g, "_");
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="PI_Records_Packet_${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
