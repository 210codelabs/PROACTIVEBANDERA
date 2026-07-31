"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import RefSelect from "@/components/RefSelect";

export default function NewPatientForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Failed to save"); return; }
    router.push(`/patients/${data.patient.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad space-y-6 max-w-3xl">
      <Section title="Demographics">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
        <Field label="DOB" name="dob" type="date" required />
        <RefSelect type="sex" label="Sex" name="sex" emit="code" showCode={false} required />
        <RefSelect type="pronouns" label="Pronouns" name="pronouns" showCode={false} />
        <RefSelect type="language" label="Preferred language" name="preferredLang" defaultValue="English" showCode={false} />
        <RefSelect type="race" label="Race" name="race" showCode={false} />
        <RefSelect type="ethnicity" label="Ethnicity" name="ethnicity" showCode={false} />
        <RefSelect type="maritalStatus" label="Marital status" name="maritalStatus" showCode={false} />
      </Section>
      <Section title="Contact">
        <Field label="Email" name="email" type="email" />
        <Field label="Phone" name="phone" type="tel" />
        <Field label="Address line 1" name="addressLine1" />
        <Field label="Address line 2" name="addressLine2" />
        <Field label="City" name="city" />
        <RefSelect type="usState" label="State" name="state" emit="code" showCode />
        <Field label="ZIP" name="postalCode" />
      </Section>
      <Section title="Insurance">
        <RefSelect type="insurer" label="Insurer" name="insurerName" showCode={false} />
        <Field label="Plan" name="insurerPlan" />
        <Field label="Member ID" name="memberId" />
        <Field label="Group #" name="groupNumber" />
      </Section>
      {error && <div className="rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? "Saving…" : "Create Patient"}</button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="section-title mb-2">{title}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} className="input" {...rest} />
    </label>
  );
}

