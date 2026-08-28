import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { buildMcsa5875, buildMecCard5876 } from "@/lib/dot/pdf";
import { fillMcsa5875, fillMcsa5876 } from "@/lib/dot/fillOfficialPdf";

export const runtime = "nodejs";

// GET /api/enterprise/dot/exams/:id/pdf?form=5875|mec  -> generate & stream PDF,
// and archive a copy to EnterpriseDocument (auto-filing).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const exam = await db.dotExam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role !== "super_admin" && exam.enterpriseId !== s.enterpriseId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = new URL(req.url).searchParams.get("form") || "5875";
  const isMec = form === "mec" || form === "5876";

  // Prefer the OFFICIAL FMCSA AcroForm templates (exact federal format); fall
  // back to the generated replica if a template can't be read.
  let bytes: Uint8Array;
  try {
    bytes = isMec ? await fillMcsa5876(exam) : await fillMcsa5875(exam);
  } catch {
    bytes = isMec ? await buildMecCard5876(exam) : await buildMcsa5875(exam);
  }
  const fname = isMec ? `MEC-5876-${exam.driverName}.pdf` : `MCSA-5875-${exam.driverName}.pdf`;

  // Auto-file into the company's documents (best effort).
  try {
    const b64 = Buffer.from(bytes).toString("base64");
    const doc = await db.enterpriseDocument.create({
      data: {
        enterpriseId: exam.enterpriseId,
        name: fname,
        mimeType: "application/pdf",
        size: bytes.length,
        dataBase64: b64,
        uploadedType: "clinic",
        uploadedName: s.name,
      },
    });
    await db.dotExam.update({ where: { id }, data: isMec ? { mecCardDocId: doc.id } : { form5875DocId: doc.id } });
  } catch {
    /* archiving is best-effort */
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"${fname.replace(/[^\w.-]/g, "_")}\"`,
    },
  });
}
