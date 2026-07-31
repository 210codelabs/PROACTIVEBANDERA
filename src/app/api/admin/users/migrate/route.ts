import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  deactivateSource: z.boolean().optional().default(true),
});

// Reassign every record owned by the source user to the target user.
// Useful when offboarding staff or merging duplicate accounts without losing history.
export async function POST(req: Request) {
  const admin = await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { sourceId, targetId, deactivateSource } = parse.data;
  if (sourceId === targetId) {
    return NextResponse.json({ error: "Source and target must be different users." }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    db.user.findUnique({ where: { id: sourceId }, select: { id: true, firstName: true, lastName: true, email: true } }),
    db.user.findUnique({ where: { id: targetId }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);
  if (!source) return NextResponse.json({ error: "Source user not found." }, { status: 404 });
  if (!target) return NextResponse.json({ error: "Target user not found." }, { status: 404 });

  const moved = await db.$transaction(async (tx) => {
    const appointments = await tx.appointment.updateMany({ where: { providerId: sourceId }, data: { providerId: targetId } });
    const encounters = await tx.encounter.updateMany({ where: { providerId: sourceId }, data: { providerId: targetId } });
    const notes = await tx.encounterNote.updateMany({ where: { authorId: sourceId }, data: { authorId: targetId } });
    const orders = await tx.order.updateMany({ where: { providerId: sourceId }, data: { providerId: targetId } });
    const messagesFrom = await tx.message.updateMany({ where: { fromUserId: sourceId }, data: { fromUserId: targetId } });
    const messagesTo = await tx.message.updateMany({ where: { toUserId: sourceId }, data: { toUserId: targetId } });
    const auditLogs = await tx.auditLog.updateMany({ where: { userId: sourceId }, data: { userId: targetId } });

    let sourceDeactivated = false;
    if (deactivateSource) {
      await tx.user.update({ where: { id: sourceId }, data: { active: false } });
      sourceDeactivated = true;
    }

    await tx.auditLog.create({
      data: {
        userId: admin.id.startsWith("demo-") ? null : admin.id,
        action: "user.migrate",
        resource: "user",
        resourceId: sourceId,
        meta: JSON.stringify({
          from: source.email,
          to: target.email,
          deactivateSource,
        }),
      },
    });

    return {
      appointments: appointments.count,
      encounters: encounters.count,
      notes: notes.count,
      orders: orders.count,
      messagesFrom: messagesFrom.count,
      messagesTo: messagesTo.count,
      auditLogs: auditLogs.count,
      sourceDeactivated,
    };
  });

  const total =
    moved.appointments +
    moved.encounters +
    moved.notes +
    moved.orders +
    moved.messagesFrom +
    moved.messagesTo +
    moved.auditLogs;

  return NextResponse.json({
    ok: true,
    moved,
    total,
    source: { id: source.id, name: `${source.firstName} ${source.lastName}` },
    target: { id: target.id, name: `${target.firstName} ${target.lastName}` },
  });
}
