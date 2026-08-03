import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getForm } from "@/lib/intake/forms";
import { renderFormPdf } from "@/lib/intake/pdf";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

// Staff: prefilled (completed copy) PDF for an online-intake submission.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
        "Content-Disposition": `inline; filename=\"proactive-${b.formSlug}-${id}.pdf\"`,
      },
    });
  } catch (err) {
    console.error("submission pdf error", err);
    return NextResponse.json({ error: "Could not generate PDF" }, { status: 500 });
  }
}
