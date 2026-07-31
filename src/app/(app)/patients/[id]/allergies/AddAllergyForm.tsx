"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import RefSelect from "@/components/RefSelect";

export default function AddAllergyForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    await fetch(`/api/patients/${patientId}/allergies`, {
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
      <RefSelect type="allergen" label="Substance" name="substance" showCode={false} required />
      <RefSelect type="allergyReaction" label="Reaction" name="reaction" showCode={false} />
      <RefSelect type="allergySeverity" label="Severity" name="severity" showCode={false} allowCreate={false} />
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" className="input" rows={2}></textarea>
      </label>
      <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Saving…" : "Add Allergy"}</button>
    </form>
  );
}
