import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { collectResources, buildEhiZip } from "@/lib/ehi/export";
import { buildCcda } from "@/lib/ehi/ccda";
import { buildPatientPdf } from "@/lib/ehi/pdf";

// GET /api/admin/ehi-export
//   ?scope=all                    → whole-practice EHI export
//   ?patientId=<id>               → single-patient EHI export
//   &format=zip|ndjson            → zip (default, per-type files) or one ndjson stream
// Admin-only. Produces FHIR R4 NDJSON per ONC Cures Act §170.315(b)(10).
export async function GET(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const patientId = url.searchParams.get("patientId");
  const format = (url.searchParams.get("format") || "zip").toLowerCase();

  if (!scope && !patientId) {
    return NextResponse.json({ error: "Provide ?scope=all or ?patientId=<id>." }, { status: 400 });
  }

  let scopeLabel = "All patients";
  let patient: any = null;
  if (patientId) {
    patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    scopeLabel = `Patient ${patient.firstName} ${patient.lastName} (MRN ${patient.mrn})`;
  }

  const stamp0 = new Date().toISOString().slice(0, 10);
  const safeName0 = patient
    ? `${patient.lastName}-${patient.mrn}`.replace(/[^A-Za-z0-9_-]/g, "")
    : "all-patients";

  // ---- Human-readable single-patient formats: C-CDA (CCD) XML and PDF ----
  if (format === "ccda" || format === "pdf") {
    if (!patientId) {
      return NextResponse.json({ error: "C-CDA and PDF exports are per-patient. Provide ?patientId=<id>." }, { status: 400 });
    }
    const full = await db.patient.findUnique({
      where: { id: patientId },
      include: { allergies: true, problems: true, medications: true, vitals: true, immunizations: true, encounters: true, documents: true },
    });
    if (!full) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

    const providers = await db.user.findMany({ select: { id: true, firstName: true, lastName: true, credential: true } }).catch(() => []);
    const pmap = new Map(providers.map((u: any) => [u.id, `${u.firstName} ${u.lastName}${u.credential ? ", " + u.credential : ""}`.trim()]));
    const providerName = (id?: string | null) => (id && pmap.get(id)) || "";

    await db.auditLog.create({
      data: { userId: admin.id, action: "ehi.export", resource: "EHI", resourceId: patientId, meta: JSON.stringify({ scope: scopeLabel, format }) },
    }).catch(() => {});

    if (format === "ccda") {
      const xml = buildCcda(full, providerName);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "content-disposition": `attachment; filename="ccd-${safeName0}-${stamp0}.xml"`,
          "cache-control": "no-store",
        },
      });
    }
    const pdf = await buildPatientPdf(full, providerName);
    return new NextResponse(pdf as any, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="summary-${safeName0}-${stamp0}.pdf"`,
        "cache-control": "no-store",
      },
    });
  }

  const { grouped, patientCount } = await collectResources(patientId || null);

  const generatedBy = `${admin.firstName} ${admin.lastName} (${admin.email})`;
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = patient
    ? `${patient.lastName}-${patient.mrn}`.replace(/[^A-Za-z0-9_-]/g, "")
    : "all-patients";

  // Audit the export (compliance requirement).
  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "ehi.export",
      resource: "EHI",
      resourceId: patientId || "all",
      meta: JSON.stringify({ scope: scopeLabel, patientCount, format }),
    },
  }).catch(() => {});

  if (format === "ndjson") {
    const lines: string[] = [];
    for (const type of Object.keys(grouped).sort()) {
      for (const r of grouped[type]) lines.push(JSON.stringify(r));
    }
    const body = lines.join("\n") + "\n";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/fhir+ndjson; charset=utf-8",
        "content-disposition": `attachment; filename="ehi-${safeName}-${stamp}.ndjson"`,
        "cache-control": "no-store",
      },
    });
  }

  const zip = await buildEhiZip({
    grouped, patientCount, scopeLabel,
    requestUrl: url.toString(), generatedBy,
  });

  return new NextResponse(zip as any, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="ehi-export-${safeName}-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}
