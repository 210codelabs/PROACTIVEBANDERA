"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddVitalsForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // capture before await (currentTarget is nulled after the handler returns)
    setLoading(true);
    try {
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch(`/api/patients/${patientId}/vitals`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save vitals");
      form.reset();
      router.refresh(); // re-fetch the server component so the new reading shows immediately
    } catch (err) {
      console.error(err);
      alert("Could not save vitals. Please check the values and try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={onSubmit}>
      <Input name="systolic" label="Systolic" type="number" />
      <Input name="diastolic" label="Diastolic" type="number" />
      <Input name="pulse" label="HR (bpm)" type="number" />
      <Input name="temperatureC" label="Temp (°C)" type="number" step="0.1" />
      <Input name="spo2" label="SpO₂ (%)" type="number" />
      <Input name="respRate" label="RR" type="number" />
      <Input name="weightKg" label="Weight (kg)" type="number" step="0.1" />
      <Input name="heightCm" label="Height (cm)" type="number" step="0.1" />
      <Input name="painScore" label="Pain (0-10)" type="number" min="0" max="10" />
      <button className="btn-primary col-span-2" disabled={loading}>{loading ? "Saving…" : "Save Vitals"}</button>
    </form>
  );
}
function Input({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="label">{label}</span><input className="input" {...rest} /></label>;
}
