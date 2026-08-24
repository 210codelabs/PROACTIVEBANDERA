import type { EnterpriseSession } from "@/lib/enterpriseAuth";
import { db } from "@/lib/db";

/**
 * Resolve which enterpriseId a portal request operates on.
 * - company_admin: always their own company (explicit param ignored).
 * - super_admin (EMR staff admin logged into the portal): from an explicit
 *   enterpriseId (query param or body). Returns null if none provided.
 */
export function resolveEnterpriseId(s: EnterpriseSession, explicit?: string | null): string | null {
  if (s.role === "super_admin") return (explicit && String(explicit).trim()) || null;
  return s.enterpriseId || null;
}

/** Load an employee and confirm it belongs to the caller's scoped company. */
export async function getScopedEmployee(s: EnterpriseSession, employeeId: string, explicitEntId?: string | null) {
  const emp = await db.enterpriseEmployee.findUnique({ where: { id: employeeId } });
  if (!emp) return { error: "Employee not found", status: 404 as const };
  if (s.role !== "super_admin" && emp.enterpriseId !== s.enterpriseId) {
    return { error: "Not found", status: 404 as const };
  }
  if (s.role === "super_admin" && explicitEntId && emp.enterpriseId !== explicitEntId) {
    return { error: "Not found", status: 404 as const };
  }
  return { employee: emp };
}

/**
 * Record a source/audit log whenever the portal writes clinical data onto a
 * patient chart, so the clinic always knows the origin of employer-supplied data.
 */
export async function logChartWrite(opts: {
  s: EnterpriseSession;
  patientId: string | null | undefined;
  companyName: string;
  field: string;
  detail?: string;
}): Promise<string> {
  const stamp = `Added via Enterprise Portal by ${opts.s.name} (${opts.companyName}) on ${new Date().toLocaleString()}`;
  try {
    await db.auditLog.create({
      data: {
        action: "enterprise.chart.write",
        resource: "Patient",
        resourceId: opts.patientId || null,
        meta: JSON.stringify({ field: opts.field, company: opts.companyName, by: opts.s.name, email: opts.s.email, detail: opts.detail || "" }),
      },
    });
  } catch {
    /* non-fatal */
  }
  return stamp;
}
