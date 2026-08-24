import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { serviceByKey } from "@/lib/enterprise/catalog";

export const runtime = "nodejs";
function nextMrn() { return `PC-${Math.floor(100000 + Math.random() * 900000)}`; }

const Body = z.object({
  serviceKey: z.string().min(1),
  priority: z.enum(["routine", "urgent"]).optional(),
  dueDate: z.string().optional().nullable(),
  employees: z.array(z.object({ firstName: z.string().min(1), lastName: z.string().min(1), dob: z.string().optional().nullable(), email: z.string().optional().nullable(), phone: z.string().optional().nullable() })).min(1).max(500),
});

export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parse = Body.safeParse(await req.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: "Provide a service and at least one employee row." }, { status: 400 });
  const b = parse.data;
  const svc = serviceByKey(b.serviceKey);
  const serviceLabel = svc?.label || b.serviceKey;
  let created = 0;
  for (const e of b.employees) {
    let patientId: string | null = null;
    try {
      const dob = e.dob ? new Date(e.dob) : new Date("1900-01-01");
      let mrn = nextMrn(); let g = 0;
      while (await db.patient.findFirst({ where: { mrn }, select: { id: true } })) { mrn = nextMrn(); if (++g > 8) break; }
      const p = await db.patient.create({ data: { mrn, firstName: e.firstName, lastName: e.lastName, dob, sex: "X", email: e.email || null, phone: e.phone || null, patientType: "clinical", status: "active" } });
      patientId = p.id;
    } catch { /* still create request */ }
    await db.enterpriseServiceRequest.create({ data: {
      enterpriseId: s.enterpriseId, patientId, employeeFirstName: e.firstName, employeeLastName: e.lastName,
      employeeDob: e.dob ? new Date(e.dob) : null, employeeEmail: e.email || null, employeePhone: e.phone || null,
      serviceKey: b.serviceKey, serviceLabel, priority: b.priority || "routine", dueDate: b.dueDate ? new Date(b.dueDate) : null,
      createdByName: s.name,
    } });
    created++;
  }
  return NextResponse.json({ ok: true, created });
}
