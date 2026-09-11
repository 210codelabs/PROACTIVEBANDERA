import { z } from "zod";
import { db } from "@/lib/db";
import { corsPreflight, handleApi, apiJson, apiError } from "@/lib/api/keys";

export async function OPTIONS() {
  return corsPreflight();
}

function serialize(e: any) {
  return {
    id: e.id,
    patientId: e.patientId,
    providerId: e.providerId,
    appointmentId: e.appointmentId ?? null,
    visitType: e.visitType ?? null,
    chiefComplaint: e.chiefComplaint ?? null,
    status: e.status,
    subjective: e.subjective ?? null,
    objective: e.objective ?? null,
    assessment: e.assessment ?? null,
    plan: e.plan ?? null,
    startedAt: e.startedAt,
    signedAt: e.signedAt ?? null,
  };
}

// GET /api/v1/encounters?patientId=&limit=&offset=
export async function GET(req: Request) {
  return handleApi(req, "encounters:read", async () => {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const where: any = {};
    if (patientId) where.patientId = patientId;

    const [total, rows] = await Promise.all([
      db.encounter.count({ where }),
      db.encounter.findMany({ where, orderBy: { startedAt: "desc" }, take: limit, skip: offset }),
    ]);
    return apiJson({ total, limit, offset, data: rows.map(serialize) });
  });
}

const CreateBody = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  visitType: z.string().optional(),
  chiefComplaint: z.string().optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

// POST /api/v1/encounters — create an encounter/visit note.
export async function POST(req: Request) {
  return handleApi(req, "encounters:write", async () => {
    const json = await req.json().catch(() => ({}));
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return apiError(400, "invalid_body", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const b = parsed.data;
    const [patient, provider] = await Promise.all([
      db.patient.findUnique({ where: { id: b.patientId }, select: { id: true } }),
      db.user.findUnique({ where: { id: b.providerId }, select: { id: true } }),
    ]);
    if (!patient) return apiError(404, "not_found", "patientId does not match a patient.");
    if (!provider) return apiError(404, "not_found", "providerId does not match a provider.");

    const enc = await db.encounter.create({
      data: {
        patientId: b.patientId,
        providerId: b.providerId,
        visitType: b.visitType || null,
        chiefComplaint: b.chiefComplaint || null,
        subjective: b.subjective || null,
        objective: b.objective || null,
        assessment: b.assessment || null,
        plan: b.plan || null,
        status: "open",
      },
    });
    return apiJson({ data: serialize(enc) }, 201);
  });
}
