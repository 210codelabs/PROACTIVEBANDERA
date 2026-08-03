import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalSession } from "@/lib/portalAuth";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

// Patient portal: download your own uploaded intake file.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.patientId !== session.patientId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = parse(doc.body);
  const m = typeof b.fileDataUrl === "string" ? b.fileDataUrl.match(/^data:([^;]+);base64,(.+)$/s) : null;
  if (!m) return NextResponse.json({ error: "No file on this record." }, { status: 404 });
  const buf = Buffer.from(m[2], "base64");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": m[1],
      "Content-Disposition": `inline; filename=\"${(b.fileName || "intake-upload").replace(/[^a-zA-Z0-9._-]/g, "_")}\"`,
    },
  });
}
