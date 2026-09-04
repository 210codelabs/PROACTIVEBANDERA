import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the server's OUTBOUND (egress) IP address — i.e. the IP that Weno
// (and other partners) see for calls made by THIS deployment. Use it to give
// Weno the exact IP to allowlist for this environment (preview vs production).
export async function GET() {
  const services = [
    "https://api.ipify.org?format=json",
    "https://ifconfig.co/json",
    "https://ipinfo.io/json",
  ];
  const tried: { service: string; ip?: string; error?: string }[] = [];
  let ip: string | null = null;

  for (const url of services) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      const d: any = await r.json().catch(() => ({}));
      const got = d.ip || d.query || null;
      tried.push({ service: url, ip: got || undefined });
      if (got && !ip) ip = String(got);
      if (ip) break;
    } catch (e: any) {
      tried.push({ service: url, error: String(e?.message || e).slice(0, 120) });
    }
  }

  return NextResponse.json({
    ok: Boolean(ip),
    egressIp: ip,
    note: "This is the outbound IP this environment uses for partner API calls (give it to Weno to allowlist).",
    checkedAt: new Date().toISOString(),
    tried,
  });
}
