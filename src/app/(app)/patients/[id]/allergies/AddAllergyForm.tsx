"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <label className="block">
        <span className="label">Substance</span>
        <input name="substance" required className="input" placeholder="Penicillin" />
      </label>
      <label className="block">
        <span className="label">Reaction</span>
        <input name="reaction" className="input" placeholder="Rash, anaphylaxis…" />
      </label>
      <label className="block">
        <span className="label">Severity</span>
        <select name="severity" className="input">
          <option value="">—</option>
          <option value="mild">Mild</option>
          <option value="moderate">Moderate</option>
          <option value="severe">Severe</option>
          <option value="life-threatening">Life-threatening</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" className="input" rows={2}></textarea>
      </label>
      <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Saving…" : "Add Allergy"}</button>
    </form>
  );
}
