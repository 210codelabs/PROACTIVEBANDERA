import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";

// Legacy enterprise export is disabled; reporting is confirmed from the patient chart.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exam = await db.dotExam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role !== "super_admin" && exam.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role !== "super_admin") {
    return NextResponse.json({ error: "Employer users cannot access clinical examination reporting data." }, { status: 403 });
  }
  return NextResponse.json({ error: "Use the signed DOT examination in the patient chart to open the official FMCSA National Registry and record a manual submission confirmation." }, { status: 410 });
}
