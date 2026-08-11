import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Bank accounts for payer EFT/ACH deposits. Full routing/account numbers are
// never returned to the client — only last4 + presence flags.
function mask(v?: string | null) {
  const s = String(v || "").replace(/\D/g, "");
  return s ? `••••${s.slice(-4)}` : null;
}
function sanitize(a: any) {
  return {
    id: a.id, label: a.label, bankName: a.bankName, accountHolder: a.accountHolder,
    accountType: a.accountType, isDefault: a.isDefault, active: a.active,
    routingMasked: mask(a.routingNumber), accountMasked: mask(a.accountNumber),
    hasRouting: Boolean(a.routingNumber), hasAccount: Boolean(a.accountNumber),
    createdAt: a.createdAt,
  };
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "billing"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.bankAccount.findMany({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }).catch(() => []);
  return NextResponse.json({ accounts: rows.map(sanitize) });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "billing"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.id && !b.label) return NextResponse.json({ error: "A label is required." }, { status: 400 });

  const routing = b.routingNumber ? String(b.routingNumber).replace(/\D/g, "") : undefined;
  if (routing !== undefined && routing !== "" && routing.length !== 9) {
    return NextResponse.json({ error: "Routing number must be 9 digits." }, { status: 400 });
  }
  const account = b.accountNumber ? String(b.accountNumber).replace(/\D/g, "") : undefined;

  // default handling: unset others when marking default
  if (b.isDefault) await db.bankAccount.updateMany({ data: { isDefault: false }, where: {} }).catch(() => {});

  const data: any = {
    label: b.label, bankName: b.bankName ?? undefined, accountHolder: b.accountHolder ?? undefined,
    accountType: b.accountType || "checking", isDefault: Boolean(b.isDefault),
  };
  // only overwrite sensitive fields when a new value is supplied
  if (routing !== undefined && routing !== "") data.routingNumber = routing;
  if (account !== undefined && account !== "") data.accountNumber = account;
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  let acct;
  if (b.id) acct = await db.bankAccount.update({ where: { id: String(b.id) }, data });
  else acct = await db.bankAccount.create({ data: { ...data, createdById: user.id, createdByName: `${user.firstName} ${user.lastName}` } });
  return NextResponse.json({ ok: true, account: sanitize(acct) });
}

export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "billing"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.bankAccount.update({ where: { id }, data: { active: false } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
