import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWenoOnlineConfig, buildComposeRxUrl, WenoOnlineError } from "@/lib/wenoOnline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  patientId: z.string().optional().nullable(),
  patient: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      dob: z.string().optional(),
    })
    .optional()
    .nullable(),
  primaryPharmacyNcpdp: z.string().optional().nullable(),
  providerEmail: z.string().optional().nullable(),
});

// POST /api/erx/weno-online/launch
// Builds a pre-filled Weno Online (ComposeRx) launch URL for the given patient.
// The URL contains an encrypted PHI + credential-derived blob and is NEVER
// logged or persisted. The browser opens it in a new tab.
export async function POST(req: Request) {
  let user;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await getWenoOnlineConfig();
  if (!cfg.enabled)
    return NextResponse.json(
      { error: "Weno Online is not enabled. Turn it on in Admin \u2192 External Integrations \u2192 Weno Online." },
      { status: 400 },
    );
  if (!cfg.ehrEncryptionKey)
    return NextResponse.json(
      { error: "Weno Online EHR Encryption Key is not set. Add it in Admin \u2192 External Integrations \u2192 Weno Online." },
      { status: 400 },
    );

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const b = parsed.success ? parsed.data : {};

  let p: any = null;
  if (b.patientId) p = await db.patient.findUnique({ where: { id: b.patientId } }).catch(() => null);

  const patient = {
    id: b.patientId || p?.id || "",
    firstName: p?.firstName || b.patient?.firstName || "",
    lastName: p?.lastName || b.patient?.lastName || "",
    gender: p?.sex || "U",
    dob: p?.dob ? new Date(p.dob).toISOString().slice(0, 10) : b.patient?.dob || "",
    address1: p?.addressLine1 || "",
    city: p?.city || "",
    state: p?.state || "",
    postalCode: p?.postalCode || "",
    phone: p?.phone || "",
  };

  if (!patient.firstName || !patient.lastName)
    return NextResponse.json(
      { error: "Select a patient with a first and last name before launching Weno Online." },
      { status: 400 },
    );

  try {
    const { url } = buildComposeRxUrl(cfg, patient, {
      primaryPharmacyNcpdp: b.primaryPharmacyNcpdp || undefined,
      providerEmail: b.providerEmail || undefined,
    });
    // Audit the launch WITHOUT the URL (it embeds PHI + credential material).
    await db.auditLog
      .create({
        data: {
          userId: user.id,
          action: "erx.wenoOnline.launch",
          resource: "Patient",
          resourceId: patient.id || null,
          meta: JSON.stringify({ environment: cfg.environment }),
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, url, environment: cfg.environment });
  } catch (e: any) {
    const status = e instanceof WenoOnlineError ? e.status : undefined;
    return NextResponse.json(
      { error: String(e?.message || e).slice(0, 300) },
      { status: status && status >= 400 && status < 500 ? 400 : 500 },
    );
  }
}
