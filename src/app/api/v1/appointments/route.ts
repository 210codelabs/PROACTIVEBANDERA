import { z } from "zod";
import { db } from "@/lib/db";
import { corsPreflight, handleApi, apiJson, apiError } from "@/lib/api/keys";
import { clinicHoursError, minutesOfDay } from "@/lib/clinic";
import { findConflict } from "@/lib/appointments";
import { providerHoursError, nextAvailableSlot } from "@/lib/scheduling";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/v1/appointments?patientId=&providerId=&from=&to=&limit=
export async function GET(req: Request) {
  return handleApi(req, "appointments:read", async () => {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;
    const providerId = searchParams.get("providerId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (providerId) where.providerId = providerId;
    if (from || to) {
      const startOf = (v: string) => new Date(v.length === 10 ? `${v}T00:00:00.000` : v);
      const endOf = (v: string) => new Date(v.length === 10 ? `${v}T23:59:59.999` : v);
      where.startsAt = { ...(from ? { gte: startOf(from) } : {}), ...(to ? { lte: endOf(to) } : {}) };
    }

    const rows = await db.appointment.findMany({ where, orderBy: { startsAt: "asc" }, take: limit });
    return apiJson({
      total: rows.length,
      data: rows.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        providerId: r.providerId,
        serviceTypeId: r.serviceTypeId,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        status: r.status,
        location: r.location,
        reason: r.reason,
      })),
    });
  });
}

const CreateBody = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:mm"),
  serviceTypeId: z.string().optional(),
  reason: z.string().optional(),
  location: z.string().optional(),
  autoShift: z.boolean().optional(),
});

// POST /api/v1/appointments — book an appointment. By default out-of-hours /
// double-booked times auto-shift to the next open same-day slot.
export async function POST(req: Request) {
  return handleApi(req, "appointments:write", async () => {
    const json = await req.json().catch(() => ({}));
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return apiError(400, "invalid_body", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    const b = parsed.data;
    const autoShift = b.autoShift !== false; // default true

    const [patient, provider] = await Promise.all([
      db.patient.findUnique({ where: { id: b.patientId }, select: { id: true } }),
      db.user.findUnique({ where: { id: b.providerId }, select: { id: true, role: true, workingHours: true } }),
    ]);
    if (!patient) return apiError(404, "not_found", "patientId does not match a patient.");
    if (!provider) return apiError(404, "not_found", "providerId does not match a provider.");

    let durationMin = 30;
    if (b.serviceTypeId) {
      const s = await db.serviceType.findUnique({ where: { id: b.serviceTypeId } });
      if (s) durationMin = s.durationMin;
    }
    let start = new Date(`${b.day}T${b.time}:00`);
    let end = new Date(start.getTime() + durationMin * 60000);

    const hoursBad = () => clinicHoursError(start, end) || providerHoursError(provider.workingHours, start, end);
    let conflict = await findConflict(b.providerId, start, end);
    let shifted = false;

    if (autoShift && (hoursBad() || conflict)) {
      const alt = await nextAvailableSlot(b.providerId, b.day, durationMin, minutesOfDay(start), provider.workingHours);
      if (alt) {
        start = new Date(`${b.day}T${alt}:00`);
        end = new Date(start.getTime() + durationMin * 60000);
        shifted = true;
        conflict = await findConflict(b.providerId, start, end);
      }
    }

    const hoursErr = hoursBad();
    if (hoursErr) return apiError(422, "unschedulable", hoursErr);
    if (conflict) return apiError(409, "conflict", "The provider already has an appointment in that time.");

    const appt = await db.appointment.create({
      data: {
        patientId: b.patientId,
        providerId: b.providerId,
        serviceTypeId: b.serviceTypeId || null,
        startsAt: start,
        endsAt: end,
        location: b.location || "in-office",
        reason: b.reason || null,
        status: "scheduled",
      },
    });
    return apiJson({
      data: { id: appt.id, patientId: appt.patientId, providerId: appt.providerId, startsAt: appt.startsAt, endsAt: appt.endsAt, status: appt.status },
      shifted,
    }, 201);
  });
}
