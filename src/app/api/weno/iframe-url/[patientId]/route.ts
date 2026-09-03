import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { WenoIntegrationService, WenoOnlineError } from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Roles allowed to prescribe (open the Weno EZ ComposeRx iFrame).
const PRESCRIBER_ROLES = ["provider", "admin"];

// GET /api/weno/iframe-url/[patientId]
// Returns an authenticated Weno EZ (ComposeRx) iFrame URL for the patient so the
// client can render it directly. Steps: authN/authZ (prescriber) -> gather
// patient demographics + prescriber info -> build & encrypt the ComposeRx
// payload (AES-256-CBC per Weno) -> return { iframeUrl }.
export async function GET(_req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  // 1) Authentication
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  // 2) Authorization — must be a prescriber
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber account is required to open e-prescribing." }, { status: 403 });
  }

  const { patientId } = await params;
  if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

  // 3) Gather mandatory patient demographics
  const p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
  if (!p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const patient = {
    id: p.id,
    firstName: p.firstName || "",
    lastName: p.lastName || "",
    dob: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
    gender: p.sex || "",
    address1: p.addressLine1 || "",
    city: p.city || "",
    state: p.state || "",
    postalCode: p.postalCode || "",
    phone: p.phone || "",
  };

  const svc = new WenoIntegrationService();

  // 4) Validate — 400 telling exactly which field(s) are missing
  const { ok, missing } = svc.validatePatient(patient);
  if (!ok) {
    return NextResponse.json(
      { error: `Missing required patient information: ${missing.join(", ")}. Please complete the patient chart before prescribing.`, missing },
      { status: 400 },
    );
  }

  const prescriber = {
    id: user.id,
    npi: user.npi || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
  };

  // 5) Build the encrypted, authenticated iFrame URL
  try {
    const orgTxId = crypto.randomUUID().replace(/-/g, "");
    const { iframeUrl, environment } = await svc.buildIframeUrl(patient, prescriber, { orgTransactionId: orgTxId });

    // Audit WITHOUT the URL (it embeds PHI + credential-derived material).
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "erx.wenoEz.iframeUrl",
        resource: "Patient",
        resourceId: patient.id,
        meta: JSON.stringify({ environment, orgTxId, prescriberNpi: prescriber.npi || null }),
      },
    }).catch(() => {});

    // 6) Respond with the authenticated iFrame URL for direct rendering
    return NextResponse.json({ iframeUrl, environment, orgTransactionId: orgTxId });
  } catch (e: any) {
    const status = e instanceof WenoOnlineError ? e.status : undefined;
    return NextResponse.json(
      { error: String(e?.message || e).slice(0, 300) },
      { status: status && status >= 400 && status < 500 ? 400 : 500 },
    );
  }
}
