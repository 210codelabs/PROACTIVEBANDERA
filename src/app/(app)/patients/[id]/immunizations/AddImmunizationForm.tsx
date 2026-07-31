"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import RefSelect from "@/components/RefSelect";

export default function AddImmunizationForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    await fetch(`/api/patients/${patientId}/immunizations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    (e.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <RefSelect
        type="vaccine"
        label="Vaccine (CVX)"
        name="vaccine"
        codeName="cvxCode"
        showCode
        required
        placeholder="Search vaccine or CVX code…"
      />
      <label className="block">
        <span className="label">Date given</span>
        <input type="date" name="givenAt" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Lot #</span>
          <input name="lot" className="input" placeholder="e.g., AB1234" />
        </label>
        <label className="block">
          <span className="label">Site</span>
          <input name="site" className="input" placeholder="e.g., L deltoid" />
        </label>
      </div>
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" className="input" rows={2}></textarea>
      </label>
      <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Saving…" : "Add Immunization"}</button>
    </form>
  );
}
