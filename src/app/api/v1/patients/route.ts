import { z } from "zod";
import { db } from "@/lib/db";
import { corsPreflight, handleApi, apiJson, apiError } from "@/lib/api/keys";

export async function OPTIONS() {
  return corsPreflight();
}

function serialize(p: any) {
  return {
    id: p.id,
    mrn: p.mrn,
    firstName: p.firstName,
    lastName: p.lastName,
    dob: p.dob,
    sex: p.sex,
    email: p.email ?? null,
    phone: p.phone ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    postalCode: p.postalCode ?? null,
    status: p.status,
    createdAt: p.createdAt,
  };
}

// GET /api/v1/patients?query=&status=&limit=&offset=
export async function GET(req: Request) {
  return handleApi(req, "patients:read", async () => {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("query") || "").trim();
    const status = searchParams.get("status") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

    const where: any = {};
    if (status) where.status = status;
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { mrn: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      db.patient.count({ where }),
      db.patient.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    ]);

    return apiJson({ total, limit, offset, data: rows.map(serialize) });
  });
}

const CreateBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1), // ISO date or YYYY-MM-DD
  sex: z.enum(["M", "F", "X"]),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  preferredLang: z.string().optional(),
});

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}

// POST /api/v1/patients — register a new patient.
export async function POST(req: Request) {
  return handleApi(req, "patients:write", async () => {
    const json = await req.json().catch(() => ({}));
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return apiError(400, "invalid_body", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const { dob, ...rest } = parsed.data;
    const d = new Date(dob.length === 10 ? `${dob}T00:00:00.000Z` : dob);
    if (isNaN(d.getTime())) return apiError(400, "invalid_body", "dob is not a valid date.");
    const patient = await db.patient.create({ data: { ...rest, dob: d, mrn: nextMrn(), patientType: "clinical" } });
    return apiJson({ data: serialize(patient) }, 201);
  });
}
