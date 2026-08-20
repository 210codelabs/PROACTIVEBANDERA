import { db } from "@/lib/db";

/**
 * Practice analytics aggregation. Computes a comprehensive, segregated snapshot
 * of the practice across patients, scheduling, revenue, pharmacy, inventory and
 * specialties for a given date range. Server-only.
 *
 * Headline totals use cheap count() queries; breakdowns/time-series fetch capped
 * minimal-field arrays and bucket in JS (fine for MVP data volumes).
 */

export type Range = { from: Date; to: Date };

const CAP = 20000;

function monthKey(d: Date | string): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  let guard = 0;
  while (cur <= end && guard < 120) {
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
    guard++;
  }
  return out;
}

function tally<T extends string>(rows: any[], key: (r: any) => T | null | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function seriesByMonth(rows: any[], dateField: string, months: string[], valueFn?: (r: any) => number): { month: string; count: number }[] {
  const m: Record<string, number> = {};
  for (const mo of months) m[mo] = 0;
  for (const r of rows) {
    const d = r[dateField];
    if (!d) continue;
    const k = monthKey(d);
    if (k in m) m[k] += valueFn ? valueFn(r) : 1;
  }
  return months.map((mo) => ({ month: mo, count: m[mo] || 0 }));
}

export async function computeAnalytics(range: Range) {
  const { from, to } = range;
  const months = monthsBetween(from, to);
  const inRange = { gte: from, lte: to };

  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch { return fallback; }
  };

  // ---- headline counts ----
  const [
    patientsTotal,
    patientsNew,
    appointmentsTotal,
    encountersTotal,
    posCount,
    claimsTotal,
  ] = await Promise.all([
    safe(db.patient.count({ where: { status: "active" } }), 0),
    safe(db.patient.count({ where: { createdAt: inRange } }), 0),
    safe(db.appointment.count({ where: { startsAt: inRange } }), 0),
    safe(db.encounter.count({ where: { createdAt: inRange } }), 0),
    safe(db.posSale.count({ where: { createdAt: inRange } }), 0),
    safe(db.claim.count({ where: { createdAt: inRange } }), 0),
  ]);

  // ---- arrays for breakdowns/time-series ----
  const [patients, appointments, posSales, claims, orders, inventory, eligibility, specialtiesRaw, users, remits] = await Promise.all([
    safe(db.patient.findMany({ where: { createdAt: inRange }, select: { createdAt: true }, take: CAP }), [] as any[]),
    safe(db.appointment.findMany({ where: { startsAt: inRange }, select: { startsAt: true, status: true, location: true, providerId: true, serviceTypeId: true }, take: CAP }), [] as any[]),
    safe(db.posSale.findMany({ where: { createdAt: inRange }, select: { createdAt: true, totalCents: true, status: true }, take: CAP }), [] as any[]),
    safe(db.claim.findMany({ where: { createdAt: inRange }, select: { status: true, totalChargeCents: true, paidCents: true, createdAt: true }, take: CAP }), [] as any[]),
    safe(db.order.findMany({ where: { createdAt: inRange }, select: { type: true, status: true, createdAt: true }, take: CAP }), [] as any[]),
    safe(db.inventoryItem.findMany({ where: { active: true }, select: { category: true, quantityOnHand: true, reorderLevel: true, unitCostCents: true, expiresAt: true }, take: CAP }), [] as any[]),
    safe(db.eligibilityCheck.findMany({ where: { createdAt: inRange }, select: { status: true, createdAt: true }, take: CAP }), [] as any[]),
    safe(db.specialty.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }], include: { _count: { select: { providers: true, patients: true } } } }), [] as any[]),
    safe(db.user.findMany({ where: { active: true }, select: { role: true } }), [] as any[]),
    safe(db.remittance.findMany({ where: { createdAt: inRange }, select: { totalPaidCents: true, createdAt: true }, take: CAP }), [] as any[]),
  ]);

  // ---- patients breakdown ----
  const [allActiveBySex, allByStatus] = await Promise.all([
    safe(db.patient.findMany({ where: {}, select: { sex: true, status: true }, take: CAP }), [] as any[]),
    Promise.resolve(null),
  ]);
  const patientsBySex = tally(allActiveBySex, (r) => (r.sex as string));
  const patientsByStatus = tally(allActiveBySex, (r) => (r.status as string));

  // ---- appointments breakdown ----
  const apptByStatus = tally(appointments, (r) => r.status);
  const apptByLocation = tally(appointments, (r) => r.location || "unspecified");
  const noShow = apptByStatus["no-show"] || 0;
  const completed = apptByStatus["completed"] || 0;
  const cancelled = apptByStatus["cancelled"] || 0;
  const noShowRate = appointmentsTotal > 0 ? Math.round((noShow / appointmentsTotal) * 1000) / 10 : 0;

  // provider + service name resolution
  const provCount = tally(appointments, (r) => r.providerId);
  const svcCount = tally(appointments, (r) => r.serviceTypeId);
  const provIds = Object.keys(provCount).slice(0, 50);
  const svcIds = Object.keys(svcCount).slice(0, 50);
  const [provRows, svcRows] = await Promise.all([
    provIds.length ? safe(db.user.findMany({ where: { id: { in: provIds } }, select: { id: true, firstName: true, lastName: true, credential: true } }), [] as any[]) : Promise.resolve([] as any[]),
    svcIds.length ? safe(db.serviceType.findMany({ where: { id: { in: svcIds } }, select: { id: true, name: true } }), [] as any[]) : Promise.resolve([] as any[]),
  ]);
  const provName: Record<string, string> = {};
  for (const u of provRows) provName[u.id] = `${u.firstName} ${u.lastName}${u.credential ? ", " + u.credential : ""}`;
  const svcName: Record<string, string> = {};
  for (const s of svcRows) svcName[s.id] = s.name;
  const topProviders = Object.entries(provCount).map(([id, count]) => ({ name: provName[id] || "Unknown", count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const byService = Object.entries(svcCount).map(([id, count]) => ({ name: svcName[id] || "Other", count })).sort((a, b) => b.count - a.count).slice(0, 8);

  // ---- revenue ----
  const claimsByStatus = tally(claims, (r) => r.status);
  const chargesCents = claims.reduce((s, c) => s + (c.totalChargeCents || 0), 0);
  const claimPaidCents = claims.reduce((s, c) => s + (c.paidCents || 0), 0);
  const remitPaidCents = remits.reduce((s, r) => s + (r.totalPaidCents || 0), 0);
  const posTotalCents = posSales.reduce((s, p) => s + (p.totalCents || 0), 0);
  const eligByStatus = tally(eligibility, (r) => r.status);
  const eligActive = eligByStatus["active"] || 0;
  const eligTotal = eligibility.length;
  const eligibilityActiveRate = eligTotal > 0 ? Math.round((eligActive / eligTotal) * 1000) / 10 : 0;

  // ---- pharmacy / orders ----
  const rx = orders.filter((o) => o.type === "rx");
  const rxByStatus = tally(rx, (r) => r.status);
  const ordersByType = tally(orders, (r) => r.type);

  // ---- inventory ----
  const onHandValueCents = inventory.reduce((s, i) => s + (i.unitCostCents || 0) * (i.quantityOnHand || 0), 0);
  const lowStock = inventory.filter((i) => (i.quantityOnHand || 0) <= (i.reorderLevel || 0)).length;
  const soon = Date.now() + 90 * 86400000;
  const expiringSoon = inventory.filter((i) => i.expiresAt && new Date(i.expiresAt).getTime() < soon).length;
  const invByCatMap: Record<string, { count: number; valueCents: number }> = {};
  for (const i of inventory) {
    const c = i.category || "other";
    if (!invByCatMap[c]) invByCatMap[c] = { count: 0, valueCents: 0 };
    invByCatMap[c].count += 1;
    invByCatMap[c].valueCents += (i.unitCostCents || 0) * (i.quantityOnHand || 0);
  }
  const inventoryByCategory = Object.entries(invByCatMap).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.count - a.count);

  // ---- specialties ----
  const specialties = specialtiesRaw
    .map((s: any) => ({ name: s.name, providerCount: s._count?.providers || 0, patientCount: s._count?.patients || 0 }))
    .sort((a, b) => b.patientCount - a.patientCount);

  // ---- providers ----
  const providerByRole = tally(users, (r) => r.role);

  return {
    range: { from: from.toISOString(), to: to.toISOString(), months },
    kpis: {
      patientsTotal,
      patientsNew,
      appointmentsTotal,
      encountersTotal,
      revenueChargesCents: chargesCents,
      revenuePaidCents: claimPaidCents + remitPaidCents,
      posSalesCents: posTotalCents,
      posCount,
      noShowRate,
      eligibilityActiveRate,
      inventoryValueCents: onHandValueCents,
      lowStockCount: lowStock,
      claimsTotal,
      specialtiesCount: specialties.length,
    },
    patients: {
      total: patientsTotal,
      new: patientsNew,
      byStatus: patientsByStatus,
      bySex: patientsBySex,
      newByMonth: seriesByMonth(patients, "createdAt", months),
    },
    appointments: {
      total: appointmentsTotal,
      byStatus: apptByStatus,
      byLocation: apptByLocation,
      byMonth: seriesByMonth(appointments, "startsAt", months),
      noShow,
      completed,
      cancelled,
      noShowRate,
    },
    scheduling: { topProviders, byService },
    revenue: {
      claims: { total: claimsTotal, byStatus: claimsByStatus, chargesCents, paidCents: claimPaidCents },
      remittancesPaidCents: remitPaidCents,
      pos: { count: posCount, totalCents: posTotalCents, byMonth: seriesByMonth(posSales, "createdAt", months, (r) => (r.totalCents || 0)) },
      eligibility: { total: eligTotal, byStatus: eligByStatus, activeRate: eligibilityActiveRate },
    },
    pharmacy: { rxPending: rxByStatus["pending"] || 0, rxSent: rxByStatus["sent"] || 0, rxByStatus, ordersByType },
    inventory: { itemCount: inventory.length, lowStock, onHandValueCents, expiringSoon, byCategory: inventoryByCategory },
    specialties,
    providers: { count: users.length, byRole: providerByRole },
  };
}

export type Analytics = Awaited<ReturnType<typeof computeAnalytics>>;
