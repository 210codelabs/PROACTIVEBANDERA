import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-click: relabel any leftover pharmacy/order rows from the retired
// "surescripts" network label to "weno". Idempotent.
export async function POST() {
  const u = await getSession();
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ph = await db.pharmacy
    .updateMany({ where: { network: "surescripts" }, data: { network: "weno" } })
    .catch(() => ({ count: 0 }));
  const ord = await db.order
    .updateMany({ where: { routingNetwork: "surescripts" }, data: { routingNetwork: "weno" } })
    .catch(() => ({ count: 0 }));

  return NextResponse.json({ ok: true, pharmacies: ph.count, orders: ord.count });
}
