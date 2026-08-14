import { renderComparisonPdf } from "@/lib/comparisonPdf";

// Public marketing collateral — sharable with prospects. No auth required.
export async function GET(req: Request) {
  const pdf = await renderComparisonPdf();
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="ProactiveClinic-EHR-Comparison.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
