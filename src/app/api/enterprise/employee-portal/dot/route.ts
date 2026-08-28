import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmployeeSession } from "@/lib/employeeAuth";

export const runtime = "nodejs";

// GET /api/enterprise/employee-portal/dot -> the signed-in driver's DOT exams.
export async function GET() {
  const s = await getEmployeeSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exams = await db.dotExam.findMany({
    where: { employeeId: s.employeeId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, status: true, outcome: true, driverName: true, driverInfo: true,
      healthHistory: true, driverSignedAt: true, expiresOn: true, mecCardDocId: true, createdAt: true,
    },
  });
  return NextResponse.json({ exams });
}
