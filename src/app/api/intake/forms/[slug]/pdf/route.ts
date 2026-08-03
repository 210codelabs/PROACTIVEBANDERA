import { NextResponse } from "next/server";
import { getForm } from "@/lib/intake/forms";
import { renderFormPdf } from "@/lib/intake/pdf";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "es" ? "es" : "en";
  try {
    const bytes = await renderFormPdf(form, { lang });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proactive-${slug}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("intake pdf error", err);
    return NextResponse.json({ error: "Could not generate PDF" }, { status: 500 });
  }
}

// Render a FILLED copy from values the user just entered (public — returns
// the user's own data straight back to them; nothing is stored here).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  const b = await req.json().catch(() => null);
  const values = b && typeof b.values === "object" ? b.values : {};
  const lang = b?.lang === "es" ? "es" : "en";
  try {
    const bytes = await renderFormPdf(form, { values, lang });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proactive-${slug}.pdf"`,
      },
    });
  } catch (err) {
    console.error("intake pdf(post) error", err);
    return NextResponse.json({ error: "Could not generate PDF" }, { status: 500 });
  }
}
