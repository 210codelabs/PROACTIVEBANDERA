import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { ensureAccessToken, fetchPatientEverything, getConnection, isProvider, searchPatients } from "@/lib/fhir/client";
import { extractFromFhirResources } from "@/lib/import/clinical";
import { persistExtracted } from "@/lib/import/persist";

// POST /api/admin/fhir/[provider]/import
// Body: { patientId? } OR { mrn? , family?, given?, birthdate? }, defaultProviderId?
// If no patientId is given, searches by identifier/name+DOB first. Requires
// exactly one patient match (unless patientId supplied). Fetches all supported
// clinical resources, normalizes with the SAME engine as the file importer,
// and persists via persistExtracted. Requires an active (connected) token.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const conn = await getConnection(provider);
  if (!conn) return NextResponse.json({ error: "This provider is not configured yet." }, { status: 400 });
  if (conn.status !== "connected" || !conn.accessToken) {
    return NextResponse.json({ error: "Not connected. Click Connect to authorize this practice before importing." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const defaultProviderId = b.defaultProviderId ? String(b.defaultProviderId) : null;

  let token: string;
  try { token = await ensureAccessToken(conn); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 400 }); }

  // Resolve the FHIR patient id
  let patientId = b.patientId ? String(b.patientId) : "";
  if (!patientId) {
    const q = { mrn: b.mrn ? String(b.mrn) : undefined, family: b.family ? String(b.family) : undefined, given: b.given ? String(b.given) : undefined, birthdate: b.birthdate ? String(b.birthdate) : undefined };
    if (!q.mrn && !q.family) return NextResponse.json({ error: "Provide a patient MRN/identifier, or a family name (optionally with given name and birthdate)." }, { status: 400 });
    let matches: any[];
    try { matches = await searchPatients(conn, token, q); }
    catch (e: any) { return NextResponse.json({ error: `Patient search failed: ${String(e?.message || e)}` }, { status: 502 }); }
    if (matches.length === 0) return NextResponse.json({ error: "No matching patient found in the source EHR." }, { status: 404 });
    if (matches.length > 1) {
      return NextResponse.json({
        error: "Multiple patients matched — refine the search or pick one.",
        candidates: matches.slice(0, 10).map((m: any) => ({ id: m.id, name: [m.name?.[0]?.given?.join(" "), m.name?.[0]?.family].filter(Boolean).join(" "), birthDate: m.birthDate, mrn: m.identifier?.[0]?.value })),
      }, { status: 409 });
    }
    patientId = matches[0].id;
  }

  // Fetch everything for that patient
  let resources: any[];
  try { resources = await fetchPatientEverything(conn, token, patientId); }
  catch (e: any) { return NextResponse.json({ error: `Import fetch failed: ${String(e?.message || e)}` }, { status: 502 }); }

  const ex = extractFromFhirResources(resources);
  if (!ex.patient.firstName && !ex.patient.lastName) {
    return NextResponse.json({ error: "Fetched data did not include a usable Patient resource." }, { status: 422 });
  }

  const result = await persistExtracted(ex, { defaultProviderId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await db.fhirConnection.update({ where: { provider }, data: { lastImportAt: new Date() } }).catch(() => {});
  const job = await db.importJob.create({
    data: {
      source: `${provider}_fhir`, entity: "clinical", status: "completed",
      total: result.total, created: result.created, skipped: result.skipped, failed: 0,
      createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true, jobId: job?.id || null, provider,
    sourcePatientId: patientId, resourceCount: resources.length,
    patientId: result.patientId, patientCreated: result.patientCreated,
    counts: result.counts, total: result.total, created: result.created, skipped: result.skipped, notice: result.notice,
  });
}
