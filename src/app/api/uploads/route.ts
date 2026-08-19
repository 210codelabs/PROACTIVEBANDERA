import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const OK_MIME = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i;

/**
 * POST /api/uploads  (multipart/form-data, field "file")
 * Stores a small image in Mongo and returns { id, url } where url is
 * /api/uploads/<id>. Used by the inventory product editor image button.
 */
export async function POST(req: Request) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 }); }
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  if (!OK_MIME.test(file.type)) return NextResponse.json({ error: "Only PNG, JPG, WEBP, GIF or SVG images are allowed." }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Image is too large (max 3 MB)." }, { status: 400 });

  const kind = (fd.get("kind") as string) || "other";
  const up = await db.upload.create({
    data: {
      filename: file.name || null,
      mime: file.type,
      size: buf.length,
      data: buf.toString("base64"),
      kind,
      createdById: user.id,
    },
  });
  return NextResponse.json({ id: up.id, url: `/api/uploads/${up.id}`, mime: up.mime, size: up.size });
}
