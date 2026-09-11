import { db } from "@/lib/db";
import { corsPreflight, handleApi, apiJson, apiError } from "@/lib/api/keys";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/v1/patients/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleApi(req, "patients:read", async () => {
    const p = await db.patient.findUnique({ where: { id } });
    if (!p) return apiError(404, "not_found", "Patient not found.");
    return apiJson({
      data: {
        id: p.id,
        mrn: p.mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.dob,
        sex: p.sex,
        pronouns: p.pronouns ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        addressLine1: p.addressLine1 ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        postalCode: p.postalCode ?? null,
        preferredLang: p.preferredLang ?? null,
        insurerName: p.insurerName ?? null,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    });
  });
}
