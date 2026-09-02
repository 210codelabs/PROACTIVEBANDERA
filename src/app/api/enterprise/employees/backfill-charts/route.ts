import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { resolveEnterpriseId } from "@/lib/enterprise/scope";
import { ensureEmployeeChart, syncDotExamToChart } from "@/lib/enterprise/chartSync";

export const runtime = "nodejs";

// POST /api/enterprise/employees/backfill-charts
// Links every employee missing an EMR chart, and syncs each employee's latest
// DOT exam vitals/medications into that chart. Scoped to the selected company
// (super_admin without a company scope backfills all).
export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entId = resolveEnterpriseId(s, new URL(req.url).searchParams.get("enterpriseId"));
  const where = entId ? { enterpriseId: entId } : {};

  const employees = await db.enterpriseEmployee.findMany({ where, take: 5000 });
  let linked = 0, synced = 0;
  for (const emp of employees) {
    const pid = await ensureEmployeeChart(emp);
    if (pid && !emp.patientId) linked++;
    if (!pid) continue;
    const latest = await db.dotExam.findFirst({ where: { employeeId: emp.id }, orderBy: { updatedAt: "desc" } }).catch(() => null);
    if (latest) { await syncDotExamToChart({ ...latest, patientId: pid }).catch(() => {}); synced++; }
  }
  return NextResponse.json({ ok: true, employeesProcessed: employees.length, chartsLinked: linked, examsSynced: synced });
}
