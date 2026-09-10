import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWenoOnlineConfig, isWenoOnlineConfigured } from "@/lib/wenoOnline";

export const runtime = "nodejs";

// Lightweight status for the eRx UI: is Weno EZ Integration configured and which
// environment. Never returns secrets.
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const online = await getWenoOnlineConfig();

  // POLICY: this clinic has a single supervising prescriber who signs/approves
  // every e-prescription regardless of which staff member is logged in (access
  // itself stays role-based). So the prescriber attributed to Weno is ALWAYS the
  // default registered Weno prescriber, not the session user.
  const defaultRx = await db.wenoPrescriber
    .findFirst({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { lastName: "asc" }] })
    .catch(() => null);
  const prescriber = defaultRx
    ? {
        npi: defaultRx.npi || "",
        dea: defaultRx.dea || "",
        firstName: defaultRx.firstName || "",
        lastName: defaultRx.lastName || "",
        name: [defaultRx.firstName, defaultRx.lastName].filter(Boolean).join(" ").trim(),
      }
    : {
        npi: online.prescriberNpi || "",
        dea: online.prescriberDea || "",
        firstName: online.prescriberFirst || "",
        lastName: online.prescriberLast || "",
        name: [online.prescriberFirst, online.prescriberLast].filter(Boolean).join(" ").trim(),
      };

  return NextResponse.json({
    // Weno EZ Integration is the single e-prescribing path.
    enabled: online.enabled,
    configured: isWenoOnlineConfigured(online),
    environment: online.environment,
    epcs: false,
    online: {
      enabled: online.enabled,
      configured: isWenoOnlineConfigured(online),
      keySet: Boolean(online.ehrEncryptionKey),
      environment: online.environment,
      prescriber,
    },
  });
}
