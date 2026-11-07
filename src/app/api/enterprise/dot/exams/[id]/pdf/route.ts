import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { fillMcsa5875 } from "@/lib/dot/fillOfficialPdf";

export const runtime = "nodejs";

// GET /api/enterprise/dot/exams/:id/pdf?form=5875|mec -> render the official form.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exam = await db.dotExam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role !== "super_admin" && exam.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = new URL(req.url).searchParams.get("form") || "5875";
  const isMec = form === "mec" || form === "5876";
  if (!isMec && form !== "5875") return NextResponse.json({ error: "Unsupported form" }, { status: 400 });
  if (isMec) {
    return NextResponse.json({ error: "MEC issuance is unavailable until authorized examiner signing and document locking are implemented." }, { status: 409 });
  }
  if (s.role !== "super_admin") {
    return NextResponse.json({ error: "Driver authorization is required before an employer can access the medical examination report." }, { status: 403 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await fillMcsa5875(exam);
  } catch {
    return NextResponse.json({ error: "The official MCSA-5875 template is unavailable or could not be populated." }, { status: 503 });
  }
  const fname = `MCSA-5875-${exam.driverName}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"${fname.replace(/[^\w.-]/g, "_")}\"`,
    },
  });
}
