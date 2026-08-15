import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { probeServer, isProvider, expectedImportResources } from "@/lib/fhir/client";

/**
 * Test a FHIR server URL by reading its public CapabilityStatement (/metadata).
 * No vendor token required — this confirms reachability + the FHIR version so
 * the connector can be configured correctly (R4 vs DSTU2/R2).
 *
 * GET  /api/admin/fhir/probe?baseUrl=...&provider=veradigm&save=1
 */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "";
  let baseUrl = (searchParams.get("baseUrl") || "").trim();

  // Fall back to the stored connection's base URL if none supplied.
  if (!baseUrl && isProvider(provider)) {
    const conn = await db.fhirConnection.findUnique({ where: { provider } }).catch(() => null);
    baseUrl = conn?.baseUrl || "";
  }
  if (!baseUrl) return NextResponse.json({ error: "A FHIR base URL is required." }, { status: 400 });

  const result = await probeServer(baseUrl);

  // Optionally persist the detected version/software/resources onto the connection.
  if (result.ok && result.version && searchParams.get("save") === "1" && isProvider(provider)) {
    await db.fhirConnection.updateMany({
      where: { provider },
      data: { fhirVersion: result.version, fhirSoftware: result.software || null, fhirSupported: (result.supported || []) as object },
    }).catch(() => {});
  }

  // Resource preflight: which resource types we plan to import are missing.
  let preflight: { expected: string[]; missing: string[] } | undefined;
  if (result.ok && result.supported) {
    const expected = expectedImportResources(result.version || "r4");
    const have = new Set(result.supported);
    preflight = { expected, missing: expected.filter((t) => !have.has(t)) };
  }

  return NextResponse.json({ baseUrl, ...result, preflight });
}
