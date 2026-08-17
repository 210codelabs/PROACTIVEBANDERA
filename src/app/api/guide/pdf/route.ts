import { NextResponse } from "next/server";
import { buildGuidePdf } from "@/lib/guide/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/guide/pdf[?download=1] — public, print-ready Complete User Guide PDF.
export async function GET(req: Request) {
  const download = new URL(req.url).searchParams.get("download") === "1";
  try {
    const pdf = await buildGuidePdf();
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="proactive-clinic-user-guide.pdf"`,
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Could not generate the guide PDF.", detail: String(e?.message || e) }, { status: 500 });
  }
}
