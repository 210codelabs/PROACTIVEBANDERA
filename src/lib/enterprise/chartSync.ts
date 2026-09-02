import { db } from "@/lib/db";

function nextMrn() { return `PC-${Math.floor(100000 + Math.random() * 900000)}`; }
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return isFinite(n) ? n : null;
}

type EmpLike = { id: string; patientId?: string | null; firstName: string; lastName: string; dob?: Date | string | null; sex?: string | null; email?: string | null; phone?: string | null };

// Ensure an employee has a linked EMR patient chart; create + link if missing.
export async function ensureEmployeeChart(emp: EmpLike): Promise<string | null> {
  if (emp.patientId) return emp.patientId;
  try {
    let mrn = nextMrn(); let guard = 0;
    while (await db.patient.findFirst({ where: { mrn }, select: { id: true } })) { mrn = nextMrn(); if (++guard > 8) break; }
    const p = await db.patient.create({
      data: {
        mrn, firstName: emp.firstName, lastName: emp.lastName,
        dob: emp.dob ? new Date(emp.dob) : new Date("1900-01-01"),
        sex: emp.sex || "X", email: emp.email || null, phone: emp.phone || null,
        patientType: "clinical", status: "active",
      },
    });
    await db.enterpriseEmployee.update({ where: { id: emp.id }, data: { patientId: p.id } }).catch(() => {});
    await db.auditLog.create({ data: { action: "enterprise.employee.autolink", resource: "Patient", resourceId: p.id, meta: JSON.stringify({ employeeId: emp.id }) } }).catch(() => {});
    return p.id;
  } catch {
    return emp.patientId || null;
  }
}

// Real-time sync of a DOT exam's vitals + current medications into the linked
// patient chart. Idempotent per exam (one Vital row per exam, updated in place).
export async function syncDotExamToChart(exam: any): Promise<void> {
  if (!exam?.id) return;
  let patientId: string | null = exam.patientId || null;
  if (!patientId && exam.employeeId) {
    const emp = await db.enterpriseEmployee.findUnique({ where: { id: exam.employeeId } }).catch(() => null);
    if (emp) {
      patientId = await ensureEmployeeChart(emp);
      if (patientId) await db.dotExam.update({ where: { id: exam.id }, data: { patientId } }).catch(() => {});
    }
  }
  if (!patientId) return;

  // ---- Vitals ----
  const v = (exam.vitals || {}) as any;
  const heightIn = num(v.heightIn), weightLb = num(v.weightLb);
  const heightCm = heightIn != null ? Math.round(heightIn * 2.54 * 10) / 10 : null;
  const weightKg = weightLb != null ? Math.round(weightLb * 0.453592 * 10) / 10 : null;
  const bmi = heightCm && weightKg ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10 : null;
  const systolic = num(v.bpSystolic), diastolic = num(v.bpDiastolic), pulse = num(v.pulse);
  const hasVitals = [heightCm, weightKg, systolic, diastolic, pulse].some((x) => x != null);
  if (hasVitals) {
    const tag = `DOT exam ${exam.id}`;
    const existing = await db.vital.findFirst({ where: { patientId, notes: { contains: exam.id } } }).catch(() => null);
    const vdata = {
      takenAt: exam.examDate ? new Date(exam.examDate) : new Date(),
      heightCm, weightKg, bmi,
      systolic: systolic != null ? Math.round(systolic) : null,
      diastolic: diastolic != null ? Math.round(diastolic) : null,
      pulse: pulse != null ? Math.round(pulse) : null,
      notes: tag,
    };
    if (existing) await db.vital.update({ where: { id: existing.id }, data: vdata }).catch(() => {});
    else await db.vital.create({ data: { patientId, ...vdata } }).catch(() => {});
  }

  // ---- Current medications (free-text on the DOT exam) ----
  const di = (exam.driverInfo || {}) as any;
  const hh = (exam.healthHistory || {}) as any;
  const medsText: unknown = di.medications ?? hh.medications ?? hh.currentMedications;
  if (typeof medsText === "string" && medsText.trim().length > 1) {
    const names = medsText.split(/[\n,;]+/).map((x) => x.trim()).filter((x) => x.length > 1).slice(0, 15);
    if (names.length) {
      const existingMeds = await db.medication.findMany({ where: { patientId }, select: { name: true } }).catch(() => [] as { name: string }[]);
      const have = new Set(existingMeds.map((m) => m.name.trim().toLowerCase()));
      for (const nm of names) {
        if (have.has(nm.toLowerCase())) continue;
        await db.medication.create({ data: { patientId, name: nm, status: "active", source: "dot-exam", notes: `DOT exam ${exam.id}` } }).catch(() => {});
        have.add(nm.toLowerCase());
      }
    }
  }
}
