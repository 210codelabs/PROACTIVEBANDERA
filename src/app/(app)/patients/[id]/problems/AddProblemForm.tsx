"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import RefSelect from "@/components/RefSelect";

export default function AddProblemForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // capture before await
    setLoading(true);
    try {
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch(`/api/patients/${patientId}/problems`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save problem");
      form.reset();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Could not save the problem. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <RefSelect
        type="diagnosis"
        label="Diagnosis (ICD-10)"
        name="description"
        codeName="icd10"
        showCode
        required
        placeholder="Search diagnosis or ICD-10 code…"
      />
      <label className="block">
        <span className="label">Status</span>
        <select name="status" className="input" defaultValue="active">
          <option value="active">Active</option>
          <option value="chronic">Chronic</option>
          <option value="resolved">Resolved</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <button disabled={loading} className="btn-primary w-full">{loading ? "Saving…" : "Add Problem"}</button>
    </form>
  );
}
