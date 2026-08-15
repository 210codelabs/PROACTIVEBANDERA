import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { probeServer, iteratePatients, fetchPatientEverything } from "@/lib/fhir/client";

/**
 * Guided, READ-ONLY sandbox test for a FHIR server (validates the R2/DSTU2 or R4
 * read path end-to-end WITHOUT persisting anything). Provide a base URL and, if
 * the server requires auth, a bearer token. Pulls a small sample of patients +
 * their clinical resources and reports counts by resource type.
 *
 * POST /api/admin/fhir/sandbox-test  { baseUrl, token?, limit? (1-5) }
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const baseUrl = String(b.baseUrl || "").trim();
  const token = String(b.token || "").trim();
  const limit = Math.min(Math.max(Number(b.limit) || 2, 1), 5);
  if (!baseUrl) return NextResponse.json({ error: "A FHIR base URL is required." }, { status: 400 });

  const probe = await probeServer(baseUrl);
  if (!probe.ok) return NextResponse.json({ ok: false, reachable: false, error: probe.error || `HTTP ${probe.status}` });

  const version = probe.version || "r4";
  const conn: any = { baseUrl, fhirVersion: version };
  const result: any = {
    ok: true, reachable: true, version, versionRaw: probe.fhirVersionRaw, software: probe.software,
    patientsSampled: 0, resourceCounts: {} as Record<string, number>, notes: [] as string[],
  };

  if (!token) {
    result.notes.push("Server reachable and version detected. Provide a bearer token to pull sample patient data (most servers require authorization).");
    return NextResponse.json(result);
  }

  try {
    let n = 0;
    for await (const patient of iteratePatients(conn, token, limit, 1)) {
      n++;
      result.resourceCounts.Patient = (result.resourceCounts.Patient || 0) + 1;
      try {
        const everything = await fetchPatientEverything(conn, token, patient.id);
        for (const r of everything) {
          const t = r?.resourceType || "Unknown";
          if (t === "Patient") continue;
          result.resourceCounts[t] = (result.resourceCounts[t] || 0) + 1;
        }
      } catch (e: any) {
        result.notes.push(`Patient ${patient.id}: clinical pull failed (${String(e?.message || e).slice(0, 80)}).`);
      }
      if (n >= limit) break;
    }
    result.patientsSampled = n;
    if (n === 0) result.notes.push("Authorized, but no patients were returned (empty sandbox or scope limits).");
    else result.notes.push(`Pulled ${n} patient(s) and ${Object.entries(result.resourceCounts).filter(([k]) => k !== "Patient").reduce((s, [, v]) => s + (v as number), 0)} clinical record(s). Nothing was saved.`);
  } catch (e: any) {
    const msg = String(e?.message || e);
    result.ok = false;
    result.error = /401|403|auth/i.test(msg)
      ? "Authorization failed — the token is missing/expired or lacks read scopes."
      : `Sample pull failed: ${msg.slice(0, 160)}`;
  }

  return NextResponse.json(result);
}
