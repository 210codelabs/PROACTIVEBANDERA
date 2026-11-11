import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { resolveEnterpriseId } from "@/lib/enterprise/scope";
import { NON_BLOCKING_STATUSES, withProviderBookingLock } from "@/lib/appointments";
import { clinicDayKey, clinicHHmm, clinicHoursError, practiceWallClockToDate } from "@/lib/clinic";
import { findClinic } from "@/lib/clinicLocations";
import { providerHoursError } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getEnterpriseSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const enterpriseId = resolveEnterpriseId(session, new URL(req.url).searchParams.get("enterpriseId"));
  if (!enterpriseId) return NextResponse.json({ error: "Select a company." }, { status: 400 });
  try {
    const [appointments, employees] = await Promise.all([
      db.appointment.findMany({ where: { bookedByEnterpriseId: enterpriseId }, select: { id: true, patientId: true, startsAt: true, endsAt: true, status: true }, orderBy: { startsAt: "desc" }, take: 500 }),
      db.enterpriseEmployee.findMany({ where: { enterpriseId, status: "active" }, select: { id: true, patientId: true, firstName: true, lastName: true } }),
    ]);
    const names = new Map(employees.filter((employee) => employee.patientId).map((employee) => [employee.patientId, `${employee.firstName} ${employee.lastName}`]));
    return NextResponse.json({ appointments: appointments.map(({ patientId, ...appointment }) => ({ ...appointment, employeeName: names.get(patientId) || "Employee" })), employees: employees.filter((employee) => employee.patientId).map(({ id, firstName, lastName }) => ({ id, name: `${firstName} ${lastName}` })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Appointments are temporarily unavailable." }, { status: 503 });
  }
}

const schema = z.object({ enterpriseId: z.string().optional(), employeeId: z.string().min(1), location: z.string().min(1), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/) });

export async function POST(req: Request) {
  const session = await getEnterpriseSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an employee, clinic, date and time." }, { status: 400 });
  const { employeeId, location, day, time } = parsed.data;
  const enterpriseId = resolveEnterpriseId(session, parsed.data.enterpriseId);
  const clinic = findClinic(location);
  if (!enterpriseId || !clinic) return NextResponse.json({ error: "Choose a company and clinic." }, { status: 400 });
  const start = practiceWallClockToDate(day, time);
  const end = new Date(start.getTime() + 30 * 60000);
  if (clinicDayKey(start) !== day || clinicHHmm(start) !== time || start.getTime() <= Date.now() || clinicHoursError(start, end)) return NextResponse.json({ error: "Choose a valid future time during clinic hours." }, { status: 400 });
  try {
    const employee = await db.enterpriseEmployee.findFirst({ where: { id: employeeId, enterpriseId, status: "active" }, select: { patientId: true } });
    if (!employee?.patientId) return NextResponse.json({ error: "Employee is unavailable for booking. Contact the clinic." }, { status: 404 });
    const providers = await db.user.findMany({ where: { role: "provider", active: true }, select: { id: true, workingHours: true }, orderBy: { lastName: "asc" } });
    for (const provider of providers) {
      if (providerHoursError(provider.workingHours, start, end)) continue;
      const appointment = await withProviderBookingLock(provider.id, async (tx) => {
        const conflict = await tx.appointment.findFirst({ where: { providerId: provider.id, status: { notIn: NON_BLOCKING_STATUSES }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } });
        if (conflict) return null;
        return tx.appointment.create({ data: { patientId: employee.patientId!, providerId: provider.id, startsAt: start, endsAt: end, location: "in-office", clinicLocationId: clinic.id, status: "scheduled", bookedByEnterpriseId: enterpriseId }, select: { id: true, startsAt: true, endsAt: true, status: true } });
      });
      if (appointment) return NextResponse.json({ ok: true, appointment }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "That time is no longer available." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Could not reserve this appointment. Please try again." }, { status: 503 });
  }
}