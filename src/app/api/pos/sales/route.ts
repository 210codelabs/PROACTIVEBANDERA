import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";

const LineInput = z.object({
  itemId: z.string().optional().nullable(),
  kind: z.enum(["product", "service"]).default("product"),
  sku: z.string().optional().nullable(),
  description: z.string().min(1),
  qty: z.number().int().positive().max(999),
  unitPriceCents: z.number().int().min(0),
});

const Body = z.object({
  lines: z.array(LineInput).min(1),
  paymentMethod: z.enum(["cash", "card", "hsa-fsa", "on-account"]).default("card"),
  patientName: z.string().optional().nullable(),
  patientId: z.string().optional().nullable(),
  discountCents: z.number().int().min(0).default(0),
  amountTenderedCents: z.number().int().min(0).optional(),
  note: z.string().optional().nullable(),
});

const TAX_RATE = 0.07;

export async function POST(req: Request) {
  const user = await requireSession();
  const adminConfig = await readAdminConfig();

  if (!adminConfig.modules.integrations.posTerminal) {
    return NextResponse.json({ ok: false, error: "The point-of-sale terminal is currently disabled by admin controls." }, { status: 409 });
  }

  const json = await req.json().catch(() => ({}));
  const parse = Body.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ ok: false, error: "Invalid sale payload." }, { status: 400 });
  }
  const { lines, paymentMethod, patientName, patientId, discountCents, amountTenderedCents, note } = parse.data;

  try {
    // Look up referenced inventory items so totals and tax are computed from
    // trusted server-side pricing rather than client input.
    const itemIds = lines.map((l) => l.itemId).filter((id): id is string => !!id);
    const items = itemIds.length
      ? await db.inventoryItem.findMany({ where: { id: { in: itemIds } } })
      : [];
    const itemById = new Map(items.map((i) => [i.id, i]));

    let subtotalCents = 0;
    let taxableBaseCents = 0;
    const resolvedLines = lines.map((line) => {
      const item = line.itemId ? itemById.get(line.itemId) : undefined;
      const unitPriceCents = item ? item.retailPriceCents : line.unitPriceCents;
      const lineTotalCents = unitPriceCents * line.qty;
      subtotalCents += lineTotalCents;
      if (item?.taxable) taxableBaseCents += lineTotalCents;
      return {
        itemId: item?.id ?? null,
        kind: line.kind,
        sku: item?.sku ?? line.sku ?? null,
        description: item?.name ?? line.description,
        qty: line.qty,
        unitPriceCents,
        lineTotalCents,
      };
    });

    const appliedDiscount = Math.min(discountCents, subtotalCents);
    const discountRatio = subtotalCents > 0 ? (subtotalCents - appliedDiscount) / subtotalCents : 1;
    const taxCents = Math.round(taxableBaseCents * discountRatio * TAX_RATE);
    const totalCents = subtotalCents - appliedDiscount + taxCents;
    const tendered = amountTenderedCents ?? totalCents;
    const changeCents = Math.max(0, tendered - totalCents);

    const saleCount = await db.posSale.count();
    const number = `POS-${1001 + saleCount}`;

    const sale = await db.posSale.create({
      data: {
        number,
        status: "paid",
        cashier: `${user.firstName} ${user.lastName}`,
        patientName: patientName || null,
        patientId: patientId || null,
        subtotalCents,
        discountCents: appliedDiscount,
        taxCents,
        totalCents,
        paymentMethod,
        amountTenderedCents: tendered,
        changeCents,
        note: note || null,
        lines: { create: resolvedLines },
      },
      include: { lines: true },
    });

    // Decrement stock and record a movement for each product line tied to inventory.
    for (const line of resolvedLines) {
      if (!line.itemId) continue;
      await db.inventoryItem.update({
        where: { id: line.itemId },
        data: { quantityOnHand: { decrement: line.qty } },
      });
      await db.stockMovement.create({
        data: {
          itemId: line.itemId,
          type: "sale",
          quantity: -line.qty,
          reason: "Point-of-sale checkout",
          reference: number,
          actor: `${user.firstName} ${user.lastName}`,
        },
      });
    }

    return NextResponse.json({ ok: true, sale });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not complete the sale. Please try again." }, { status: 500 });
  }
}
