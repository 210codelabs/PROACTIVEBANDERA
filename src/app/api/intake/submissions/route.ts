import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

// Staff: list online-intake submissions + uploaded offline forms (review queue).
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "all"; // pending | approved | all

  let docs: any[] = [];
  try {
    docs = await db.document.findMany({
      where: { category: { in: ["intake", "intake-followup", "intake-upload"] } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  } catch {
    return NextResponse.json({ submissions: [] });
  }

  const patientIds = Array.from(new Set(docs.map((d) => d.patientId)));
  const patients = await db.patient.findMany({ where: { id: { in: patientIds } } });
  const pmap = new Map(patients.map((p) => [p.id, p]));

  let submissions = docs.map((d) => {
    const b = parse(d.body);
    const p = pmap.get(d.patientId);
    return {
      id: d.id,
      patientId: d.patientId,
      patientName: p ? `${p.firstName} ${p.lastName}` : "Unknown",
      mrn: p ? p.mrn : "",
      title: d.title,
      category: d.category,
      kind: d.category === "intake-upload" ? "upload" : "online",
      formSlug: b.formSlug || "",
      formTitle: b.formTitle || d.title,
      confirmation: b.confirmation || "",
      lang: b.lang || "en",
      source: b.source || "",
      fileName: b.fileName || "",
      reviewStatus: b.reviewStatus || "pending",
      reviewedByName: b.reviewedByName || "",
      reviewedAt: b.reviewedAt || "",
      submittedAt: b.submittedAt || d.createdAt,
      createdAt: d.createdAt,
    };
  });

  if (status === "pending") submissions = submissions.filter((s) => s.reviewStatus === "pending");
  else if (status === "approved") submissions = submissions.filter((s) => s.reviewStatus === "approved");

  const pendingCount = submissions.filter((s) => s.reviewStatus === "pending").length;
  return NextResponse.json({ submissions, pendingCount });
}
