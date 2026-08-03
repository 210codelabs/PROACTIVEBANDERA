import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalSession } from "@/lib/portalAuth";
import { getForm } from "@/lib/intake/forms";

const MAX_CHARS = 8_000_000;

// Patient portal: upload a completed offline intake form (PDF or image).
export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || !b.slug || !b.dataUrl) {
    return NextResponse.json({ error: "A form type and file are required." }, { status: 400 });
  }
  const form = getForm(b.slug);
  if (!form) return NextResponse.json({ error: "Unknown form." }, { status: 400 });
  if (!/^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,/.test(b.dataUrl)) {
    return NextResponse.json({ error: "File must be a PDF or image." }, { status: 400 });
  }
  if (String(b.dataUrl).length > MAX_CHARS) {
    return NextResponse.json({ error: "File is too large (max ~6MB)." }, { status: 400 });
  }
  const doc = await db.document.create({
    data: {
      patientId: session.patientId,
      title: `${form.title} — Uploaded Form`,
      category: "intake-upload",
      body: JSON.stringify({
        source: "upload",
        uploadedBy: "patient",
        uploadedByName: `${session.firstName} ${session.lastName}`,
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
