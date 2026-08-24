import { NextResponse } from "next/server";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { CONSENT_FORMS } from "@/lib/enterprise/forms";

export const runtime = "nodejs";

export async function GET() {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ forms: CONSENT_FORMS.map((f) => ({ key: f.key, title: f.title, summary: f.summary, signerRole: f.signerRole })) });
}
