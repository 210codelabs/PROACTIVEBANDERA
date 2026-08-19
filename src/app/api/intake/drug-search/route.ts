import { NextResponse } from "next/server";
import { searchDrugs } from "@/lib/openfda";

export const runtime = "nodejs";

// PUBLIC (unauthenticated) openFDA medication typeahead for the patient intake form.
// Reference-only product search; no patient data is read or written here.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2 || q.length > 80) return NextResponse.json({ results: [] });
  try {
    const results = await searchDrugs(q);
    return NextResponse.json({ results, source: "openFDA NDC Directory" });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
