import { requireSession } from "@/lib/auth";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import NewOrderForm from "./NewOrderForm";

export default async function NewOrder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  const type = (sp.type || "rx") as "rx" | "lab" | "imaging" | "referral" | "procedure";

  return (
    <PatientChart user={user} {...ctx} active="orders">
      <section className="card max-w-3xl">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">New Order — {type.toUpperCase()}</header>
        <div className="p-4"><NewOrderForm patientId={id} initialType={type} /></div>
      </section>
    </PatientChart>
  );
}
