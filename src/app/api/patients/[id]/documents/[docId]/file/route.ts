import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { extractDocumentFile } from "@/lib/documentFile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const safeName = (s: string) => s.replace(/[^\w.\- ]+/g, "_").trim().slice(0, 120) || "document";

// GET /api/patients/[id]/documents/[docId]/file[?download=1]
// Streams an uploaded chart document (PDF / image) for in-browser preview
// (inline) or as a download (attachment). Staff session required.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, docId } = await params;
  const doc = await db.document.findUnique({ where: { id: docId } }).catch(() => null);
  if (!doc || doc.patientId !== id) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const f = extractDocumentFile(doc.body);
  if (!f) {
    // Externally hosted file (http/https URL in body) -> redirect.
    const b = String(doc.body || "").trim();
    if (/^https?:\/\//i.test(b)) return NextResponse.redirect(b);
    return NextResponse.json({ error: "This document has no attached file." }, { status: 404 });
  }

  const bytes = Buffer.from(f.base64, "base64");
  const ext = EXT[f.mime] || "bin";
  let name = safeName(f.fileName || doc.title || "document");
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name = `${name}.${ext}`;

  await db.auditLog.create({
    data: { userId: user.id, action: download ? "document.download" : "document.view", resource: "Document", resourceId: doc.id, meta: JSON.stringify({ patientId: id }) },
  }).catch(() => {});

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download || f.mime === "application/xml" || f.mime === "application/json" ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
