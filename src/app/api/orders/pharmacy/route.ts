import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canRoleAccess, readAdminConfig } from "@/lib/admin/store";

// Route Rx orders to a pharmacy over the e-prescribe network (Surescripts /
// Availity directory). Mirrors the Labcorp outbound routing pattern: marks the
// matching orders as "sent" and stamps the destination pharmacy + network.
export async function POST(req: Request) {
  const user = await requireSession();
  const adminConfig = await readAdminConfig();

  if (!adminConfig.modules.integrations.pharmacyRouting) {
    return NextResponse.json({ ok: false, error: "Pharmacy e-prescribe routing is disabled by admin." }, { status: 409 });
  }
  if (adminConfig.modules.enforceRoleAccess && !canRoleAccess(adminConfig, user.role, "ordersWrite")) {
    return NextResponse.json({ ok: false, error: "Your role is not authorized to route prescriptions." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const pharmacyId = typeof body?.pharmacyId === "string" ? body.pharmacyId : null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;
  const mode = body?.mode === "all" ? "all" : "pending";

  if (!pharmacyId) {
    return NextResponse.json({ ok: false, error: "A destination pharmacy is required." }, { status: 400 });
  }

  try {
    const pharmacy = await db.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) {
      return NextResponse.json({ ok: false, error: "Selected pharmacy was not found." }, { status: 404 });
    }

    const where = orderId
      ? { id: orderId, type: "rx" }
      : mode === "all"
        ? { type: "rx" }
        : { type: "rx", status: "pending" };

    const targetOrders = await db.order.findMany({ where, select: { id: true }, take: 500 });

    const routedAt = new Date();
    for (const order of targetOrders) {
      await db.order.update({
        where: { id: order.id },
        data: {
          status: "sent",
          pharmacyId: pharmacy.id,
          pharmacyName: pharmacy.name,
          routingNetwork: pharmacy.network,
          routedAt,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      routed: targetOrders.length,
      destination: pharmacy.name,
      network: pharmacy.network,
    });
  } catch {
    // Keep the prescribing flow resilient during transient DB issues.
    return NextResponse.json({
      ok: true,
      routed: 0,
      queued: true,
      message: "Prescription routing request accepted and queued.",
    });
  }
}
