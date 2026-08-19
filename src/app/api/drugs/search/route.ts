import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { searchDrugs, searchDrugsPaged } from "@/lib/openfda";
import { enrichMedication } from "@/lib/rxnorm";

export const runtime = "nodejs";

/**
 * GET /api/drugs/search
 *
 * Two modes:
 *  1. Typeahead (default): ?q=lisin  -> up to 12 quick matches.
 *  2. Full paginated database search: pass ?pageSize=25|50|100 (and optional
 *     &page, &form, &route, &schedule, &productType). Returns ALL matching
 *     results paged, the total count, and a merged RxNorm (public database)
 *     summary for the search term.
 */
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim();

  const hasPaging = sp.has("pageSize") || sp.has("page") || sp.has("form") || sp.has("route") || sp.has("schedule") || sp.has("productType");

  // ---- Typeahead mode ----
  if (!hasPaging) {
    if (q.length < 2 || q.length > 80) return NextResponse.json({ results: [] });
    const results = await searchDrugs(q);
    return NextResponse.json({ results, source: "openFDA NDC Directory" });
  }

  // ---- Full paginated search mode ----
  const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);
  const rawSize = parseInt(sp.get("pageSize") || "25", 10) || 25;
  const pageSize = [25, 50, 100].includes(rawSize) ? rawSize : 25;
  const filters = {
    form: sp.get("form") || undefined,
    route: sp.get("route") || undefined,
    schedule: sp.get("schedule") || undefined,
    productType: sp.get("productType") || undefined,
  };

  const [paged, rxnorm] = await Promise.all([
    searchDrugsPaged(q, { page, pageSize, ...filters }),
    // Only enrich from RxNorm on the first page (keeps latency low while paging).
    page === 1 && q.length >= 2 ? enrichMedication(q).catch(() => null) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    results: paged.results,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    totalPages: Math.max(1, Math.ceil(paged.total / paged.pageSize)),
    filters,
    rxnorm,
    source: "openFDA NDC Directory + NLM RxNorm/RxNav (public)",
  });
}
