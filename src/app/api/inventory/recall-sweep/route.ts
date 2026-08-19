import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { recallLookup, type DrugRecall } from "@/lib/openfda";

export const runtime = "nodejs";

const ndcValid = (n: string) => /^[0-9]{4,5}-?[0-9]{3,4}(-?[0-9]{1,2})?$/.test(n);

// GET /api/inventory/recall-sweep — scan active inventory items that carry an NDC
// for OPEN (Ongoing) FDA recalls. Per-NDC results are cached server-side (openFDA
// TTL cache), so repeated dashboard loads are cheap.
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  let items: Array<{ id: string; name: string; sku: string; ndc: string | null; quantityOnHand: number; category: string; location: string | null }> = [];
  try {
    items = await db.inventoryItem.findMany({
      where: { active: true, ndc: { not: null } },
      select: { id: true, name: true, sku: true, ndc: true, quantityOnHand: true, category: true, location: true },
      take: 300,
    });
  } catch {
    return NextResponse.json({ checked: 0, flaggedCount: 0, flagged: [] });
  }

  const queue = items.filter((it) => it.ndc && ndcValid(it.ndc.trim()));
  const flagged: Array<Record<string, unknown>> = [];

  let idx = 0;
  const CONC = 6;
  async function worker() {
    while (idx < queue.length) {
      const it = queue[idx++];
      try {
        const { open, recalls } = await recallLookup(it.ndc!.trim());
        if (open) {
          flagged.push({
            id: it.id, name: it.name, sku: it.sku, ndc: it.ndc,
            quantityOnHand: it.quantityOnHand, category: it.category, location: it.location,
            recalls: recalls.filter((r: DrugRecall) => r.open),
          });
        }
      } catch { /* skip this item */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker));

  return NextResponse.json({ checked: queue.length, flaggedCount: flagged.length, flagged });
}
