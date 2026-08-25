import { NextResponse } from "next/server";
import { maybeAutoSyncDirectory } from "@/lib/weno";

export const runtime = "nodejs";
export const maxDuration = 60;

// Internal cron endpoint pinged by the server instrumentation scheduler.
// Protected by a shared secret header so it can't be triggered externally.
export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret || req.headers.get("x-weno-cron") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const res = await maybeAutoSyncDirectory();
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ ran: false, error: String(e?.message || e).slice(0, 200) }, { status: 200 });
  }
}
