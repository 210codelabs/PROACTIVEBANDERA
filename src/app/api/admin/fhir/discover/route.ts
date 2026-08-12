import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { discoverSmartConfig } from "@/lib/fhir/client";

// POST /api/admin/fhir/discover { baseUrl }
// Reads the SMART/OAuth endpoints from a FHIR base URL so the admin only has to
// enter the base URL. Does not require the connection to be saved first.
export async function POST(req: Request) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const baseUrl = String(b.baseUrl || "").trim();
  if (!baseUrl) return NextResponse.json({ error: "Enter the FHIR base URL first." }, { status: 400 });
  try { new URL(baseUrl); } catch { return NextResponse.json({ error: "That FHIR base URL is not a valid URL." }, { status: 400 }); }

  try {
    const cfg = await discoverSmartConfig(baseUrl);
    return NextResponse.json({ ok: true, ...cfg });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
