import { NextResponse } from "next/server";
import { getForm } from "@/lib/intake/forms";
import { renderFormPdf } from "@/lib/intake/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  try {
    const bytes = await renderFormPdf(form);
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
