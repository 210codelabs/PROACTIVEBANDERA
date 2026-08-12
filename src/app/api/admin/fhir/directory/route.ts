import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { directoryCount, searchDirectory } from "@/lib/fhir/directory";

// GET /api/admin/fhir/directory?q=...
// Searches the Practice Fusion Service Base URL directory by practice name /
// NPI / org id / city and returns the FHIR base URLs so the admin can pick
// their practice instead of typing the URL.
export async function GET(req: Request) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const q = new URL(req.url).searchParams.get("q") || "";
  const practices = searchDirectory(q, 25);
  return NextResponse.json({ ok: true, total: directoryCount(), count: practices.length, practices });
}
