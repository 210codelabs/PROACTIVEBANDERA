import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getForm } from "@/lib/intake/forms";

const MAX_CHARS = 8_000_000; // ~6MB binary as base64

// Staff: upload a scanned/offline intake form and attach it to a patient.
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || !b.patientId || !b.slug || !b.dataUrl) {
    return NextResponse.json({ error: "patientId, slug and file are required." }, { status: 400 });
  }
  const form = getForm(b.slug);
  if (!form) return NextResponse.json({ error: "Unknown form." }, { status: 400 });
  if (!/^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,/.test(b.dataUrl)) {
    return NextResponse.json({ error: "File must be a PDF or image." }, { status: 400 });
  }
  if (String(b.dataUrl).length > MAX_CHARS) {
    return NextResponse.json({ error: "File is too large (max ~6MB)." }, { status: 400 });
  }
  const patient = await db.patient.findUnique({ where: { id: b.patientId } });
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  const doc = await db.document.create({
    data: {
      patientId: b.patientId,
      title: `${form.title} — Uploaded Form`,
      category: "intake-upload",
      body: JSON.stringify({
        source: "upload",
        uploadedBy: "staff",
        uploadedByName: `${user.firstName} ${user.lastName}`,
        formSlug: form.slug,
        formTitle: form.title,
        fileName: b.fileName || `${form.slug}.pdf`,
        fileDataUrl: b.dataUrl,
        reviewStatus: "pending",
        submittedAt: new Date().toISOString(),
      }),
    },
  });
  return NextResponse.json({ ok: true, id: doc.id });
}
