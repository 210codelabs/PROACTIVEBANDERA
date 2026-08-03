import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalSession } from "@/lib/portalAuth";
import { getForm } from "@/lib/intake/forms";
import { renderFormPdf } from "@/lib/intake/pdf";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

// Patient portal: download a completed copy of your own online intake.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.patientId !== session.patientId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = parse(doc.body);
  const form = getForm(b.formSlug);
  if (!form || !b.values) return NextResponse.json({ error: "No fillable data for this submission." }, { status: 400 });
  const url = new URL(req.url);
  const lang = (url.searchParams.get("lang") || b.lang) === "es" ? "es" : "en";
  try {
    const bytes = await renderFormPdf(form, { values: b.values, lang });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"proactive-${b.formSlug}.pdf\"`,
      },
    });
  } catch (err) {
    console.error("portal intake pdf error", err);
    return NextResponse.json({ error: "Could not generate PDF" }, { status: 500 });
  }
}
