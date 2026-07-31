import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAttorneySession } from "@/lib/attorneyAuth";

export async function GET() {
  const s = await getAttorneySession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await db.recordRequest.findMany({
    where: { attorneyId: s.attorneyId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ attorney: { name: s.name, firm: s.firm, email: s.email }, requests });
}

export async function POST(req: Request) {
  const s = await getAttorneySession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const patientMrn = (b?.patientMrn || "").toString().trim();
  const patientLastName = (b?.patientLastName || "").toString().trim();
  if (!patientMrn || !patientLastName) {
    return NextResponse.json({ error: "Patient MRN and last name are required." }, { status: 400 });
  }
  const request = await db.recordRequest.create({
    data: {
      attorneyId: s.attorneyId,
      patientMrn,
      patientLastName,
      reason: b?.reason ? String(b.reason).trim() : null,
      status: "pending",
    },
  });
  return NextResponse.json({ ok: true, request }, { status: 201 });
}
