import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getStediConfig } from "@/lib/stedi";
import { bbConfig } from "@/lib/cms/bluebutton";
import { emailConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ping(url: string, ms = 6000): Promise<{ ok: boolean; ms: number; detail: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const started = Date.now();
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    return { ok: r.ok, ms: Date.now() - started, detail: `HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - started, detail: e?.name === "AbortError" ? "timeout" : String(e?.message || e).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

// GET /api/admin/connections/status
export async function GET() {
  let user; try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const stedi = await getStediConfig().catch(() => null as any);
  const bb = bbConfig();

  // Live public pings (no keys, free)
  const [nppes, openfda] = await Promise.all([
    ping("https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=1&number=1234567893"),
    ping("https://api.fda.gov/drug/ndc.json?limit=1"),
  ]);

  const checks = [
    {
      key: "stedi", name: "Stedi — Eligibility & Claims", category: "Insurance / RCM", live: false,
      configured: Boolean(stedi?.apiKey),
      state: stedi?.apiKey ? "configured" : "not_configured",
      detail: stedi?.apiKey ? `Enabled: ${stedi.enabled ? "yes" : "no"}${stedi.orgName ? " · " + stedi.orgName : ""}${stedi.defaultPayerId ? " · default payer " + stedi.defaultPayerId : ""}` : "Add your Stedi API key in Settings → Integrations.",
      usedFor: "All non-Medicare eligibility (270/271), claims, ERA.",
    },
    {
      key: "nppes", name: "NPPES — National Provider/Pharmacy Registry", category: "Directory", live: true,
      configured: true, state: nppes.ok ? "up" : "down",
      detail: `${nppes.detail} · ${nppes.ms} ms`,
      usedFor: "Provider & pharmacy NPI lookup everywhere.",
    },
    {
      key: "openfda", name: "openFDA — Drug Database", category: "Medications", live: true,
      configured: true, state: openfda.ok ? "up" : "down",
      detail: `${openfda.detail} · ${openfda.ms} ms`,
      usedFor: "Medication search (eRx, pharmacy, inventory).",
    },
    {
      key: "bluebutton", name: "CMS Blue Button 2.0 — Medicare", category: "Medicare", live: false,
      configured: bb.configured,
      state: bb.configured ? "configured" : "not_configured",
      detail: bb.configured ? `Environment: ${bb.env}` : "Set CMS_CLIENT_ID / CMS_CLIENT_SECRET.",
      usedFor: "Medicare coverage & Part-D medication import (patient-authorized).",
    },
    {
      key: "resend", name: "Resend — Email delivery", category: "Notifications", live: false,
      configured: emailConfigured(),
      state: emailConfigured() ? "configured" : "not_configured",
      detail: emailConfigured() ? "API key + from address set." : "Set RESEND_API_KEY + EMAIL_FROM to send demo/appointment emails.",
      usedFor: "Demo requests, appointment confirmations.",
    },
  ];

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString(), checks });
}
