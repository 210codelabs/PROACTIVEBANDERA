import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

// Statuses that no longer occupy a slot, so they must NOT count as a conflict.
export const NON_BLOCKING_STATUSES = ["cancelled", "no-show"];

export async function withProviderBookingLock<T>(providerId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const key = `public-booking-provider:${providerId}`;
  await db.appSetting.upsert({ where: { key }, create: { key, value: 0 }, update: {} });
  return db.$transaction(async (tx) => {
    await tx.appSetting.update({ where: { key }, data: { value: randomUUID() } });
    return operation(tx);
  });
}

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
