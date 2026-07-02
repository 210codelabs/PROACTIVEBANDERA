import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";

const Body = z.object({
  type: z.enum(["receive", "adjust", "dispense", "waste", "count"]).default("receive"),
  quantity: z.number().int(),
  reason: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const adminConfig = await readAdminConfig();

  if (!adminConfig.modules.integrations.inventoryManagement) {
    return NextResponse.json({ ok: false, error: "Inventory management is currently disabled by admin controls." }, { status: 409 });
  }

  const json = await req.json().catch(() => ({}));
  const parse = Body.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ ok: false, error: "Invalid stock movement." }, { status: 400 });
  }
  const { type, quantity, reason, reference } = parse.data;

  try {
    const item = await db.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ ok: false, error: "Inventory item not found." }, { status: 404 });
    }

    // For "count" the quantity is an absolute on-hand target; everything else is
    // a signed delta. Normalize to a delta so the movement log stays consistent.
    const delta = type === "count" ? quantity - item.quantityOnHand : quantity;
    const nextOnHand = Math.max(0, item.quantityOnHand + delta);

    const updated = await db.inventoryItem.update({
      where: { id },
      data: { quantityOnHand: nextOnHand },
    });
    await db.stockMovement.create({
      data: {
        itemId: id,
        type,
        quantity: delta,
        reason: reason || null,
        reference: reference || null,
        actor: `${user.firstName} ${user.lastName}`,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not record the stock movement." }, { status: 500 });
  }
}
