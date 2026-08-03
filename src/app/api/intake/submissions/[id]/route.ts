import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

// Staff: full submission detail (parsed values) for review.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const patient = await db.patient.findUnique({ where: { id: doc.patientId } });
  const b = parse(doc.body);
  // Do not ship the base64 file blob in the JSON detail.
  const { fileDataUrl, ...meta } = b;
  return NextResponse.json({
    id: doc.id,
    patientId: doc.patientId,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown",
    mrn: patient ? patient.mrn : "",
    title: doc.title,
    category: doc.category,
    createdAt: doc.createdAt,
    hasFile: !!fileDataUrl,
    detail: meta,
  });
}
