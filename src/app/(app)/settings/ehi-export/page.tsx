import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import EhiExportClient from "./EhiExportClient";

export const dynamic = "force-dynamic";

export default async function EhiExportPage() {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/settings");

  let patients: Array<{ id: string; mrn: string; name: string; dob: string }> = [];
  let total = 0;
  try {
    const rows = await db.patient.findMany({
      select: { id: true, mrn: true, firstName: true, lastName: true, dob: true },
      orderBy: { lastName: "asc" },
    });
    total = rows.length;
    patients = rows.map((p) => ({
      id: p.id,
      mrn: p.mrn,
      name: `${p.lastName}, ${p.firstName}`,
      dob: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
    }));
  } catch {
    /* fall through with empty list */
  }

  return (
    <Shell user={user} pageTitle="EHI Export">
      <EhiExportClient patients={patients} total={total} />
    </Shell>
  );
}
