import { db } from "@/lib/db";

// Statuses that no longer occupy a slot, so they must NOT count as a conflict.
export const NON_BLOCKING_STATUSES = ["cancelled", "no-show"];

// Find an existing appointment for the same provider whose time window overlaps
// [startsAt, endsAt). Used to prevent double-booking on create / reschedule /
// recurring series. `excludeId` skips the appointment being moved.
export async function findConflict(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
) {
  return db.appointment.findFirst({
    where: {
      providerId,
      status: { notIn: NON_BLOCKING_STATUSES },
      // overlap: existing.start < newEnd AND existing.end > newStart
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true, patientId: true },
  });
}
