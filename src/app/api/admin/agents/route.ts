import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAgentOpsSnapshot, runAgentSuite } from "@/lib/agentOps";

export const dynamic = "force-dynamic";

const Body = z.object({
  mode: z.enum(["scan", "autofix", "autonomous"]).default("scan"),
  agentIds: z
    .array(z.enum(["coding-billing", "medical-notes", "validation", "data-correction", "flow-optimizer"]))
    .optional(),
});

export async function GET() {
  await requireAdminSession();
  const snapshot = await getAgentOpsSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: Request) {
  const user = await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const run = await runAgentSuite({
    mode: parsed.data.mode,
    agentIds: parsed.data.agentIds,
    triggeredBy: user.id,
    role: user.role,
  });

  return NextResponse.json({ ok: true, run });
}
