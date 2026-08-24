import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmployeeSession } from "@/lib/employeeAuth";

export const runtime = "nodejs";

export async function GET() {
  const s = await getEmployeeSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const emp = await db.enterpriseEmployee.findUnique({ where: { id: s.employeeId } });
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Their occupational-health requests (matched by their linked chart).
  const requests = emp.patientId
    ? await db.enterpriseServiceRequest.findMany({ where: { enterpriseId: emp.enterpriseId, patientId: emp.patientId }, orderBy: { createdAt: "desc" }, take: 100 })
    : [];
  const reqIds = new Set(requests.map((r) => r.id));

  // Clinic-uploaded result documents tied to their requests.
  const docs = await db.enterpriseDocument.findMany({ where: { enterpriseId: emp.enterpriseId }, orderBy: { createdAt: "desc" }, take: 300, select: { id: true, name: true, mimeType: true, size: true, uploadedType: true, requestId: true, createdAt: true } });
  const results = docs.filter((d) => d.requestId && reqIds.has(d.requestId) && d.uploadedType === "clinic");

  const consents = await db.enterpriseConsent.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "desc" }, take: 100 });

  return NextResponse.json({
    employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, companyName: s.companyName },
    requests: requests.map((r) => ({ id: r.id, serviceLabel: r.serviceLabel, status: r.status, resultStatus: r.resultStatus, resultSummary: r.resultSummary, createdAt: r.createdAt })),
    results,
    consents,
  });
}
