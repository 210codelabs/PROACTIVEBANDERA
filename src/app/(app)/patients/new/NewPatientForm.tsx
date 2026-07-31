"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RefSelect from "@/components/RefSelect";

type Attorney = { id: string; name: string; firm: string | null; email: string };

const CASE_TYPES = [
  { value: "personal_injury", label: "Personal Injury (accident)" },
  { value: "auto_accident", label: "Auto Accident (MVA)" },
  { value: "workers_comp", label: "Workers' Compensation" },
  { value: "other", label: "Other / Legal referral" },
];

export default function NewPatientForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"clinical" | "legal">("clinical");
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [lawFirm, setLawFirm] = useState("");

  useEffect(() => {
    if (type !== "legal" || attorneys.length) return;
    fetch("/api/attorneys")
      .then((r) => (r.ok ? r.json() : { attorneys: [] }))
      .then((d) => setAttorneys(d.attorneys || []))
      .catch(() => {});
  }, [type, attorneys.length]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(form);
      const body: Record<string, unknown> = Object.fromEntries(fd.entries());
      body.patientType = type;
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      router.push(`/patients/${data.patient.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad space-y-6 max-w-3xl">
      {/* Registration type */}
      <fieldset>
        <legend className="section-title mb-2">Registration type</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setType("clinical")}
            className={`text-left rounded-xl border p-4 transition ${type === "clinical" ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/50" : "border-slate-200 hover:border-brand-300"}`}
          >
            <div className="font-semibold text-slate-900">Clinical Patient</div>
            <div className="text-xs text-slate-500 mt-1">Standard medical care — strictly clinical & HIPAA-protected.</div>
          </button>
          <button
            type="button"
            onClick={() => setType("legal")}
            className={`text-left rounded-xl border p-4 transition ${type === "legal" ? "border-amber-500 ring-2 ring-amber-200 bg-amber-50/60" : "border-slate-200 hover:border-amber-300"}`}
          >
            <div className="font-semibold text-slate-900">Physical Rehabilitation — Legal / Attorney Case</div>
            <div className="text-xs text-slate-500 mt-1">Personal injury, auto accident or workers&apos; comp — linked to an attorney / law firm.</div>
          </button>
        </div>
      </fieldset>

      {type === "legal" && (
        <fieldset className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <legend className="section-title px-1 text-amber-800">Legal / Attorney Case</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block">
              <span className="label">Case type</span>
              <select name="caseType" className="input" defaultValue="personal_injury">
                {CASE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <Field label="Case / claim number" name="caseNumber" placeholder="e.g., 2025-CI-04821" />
            <Field label="Responsible court" name="court" placeholder="e.g., Bexar County District Court" />
            <Field label="Date of injury" name="dateOfInjury" type="date" />
            <label className="block">
              <span className="label">Attorney</span>
              <select
                name="attorneyId"
                className="input"
                onChange={(e) => {
                  const a = attorneys.find((x) => x.id === e.target.value);
                  setLawFirm(a?.firm || "");
                }}
              >
                <option value="">— Select attorney —</option>
                {attorneys.map((a) => <option key={a.id} value={a.id}>{a.name}{a.firm ? ` · ${a.firm}` : ""}</option>)}
              </select>
              {attorneys.length === 0 && (
                <span className="text-[11px] text-amber-700">No attorneys on file yet — add them in Settings → Attorneys, or fill the law firm below.</span>
              )}
            </label>
            <label className="block">
              <span className="label">Law firm</span>
              <input name="lawFirm" className="input" value={lawFirm} onChange={(e) => setLawFirm(e.target.value)} placeholder="Law firm name" />
            </label>
            <Field label="Claim number (insurer)" name="claimNumber" />
            <Field label="Adjuster" name="adjuster" />
            <Field label="Defendant / at-fault insurer" name="defendantInsurer" />
          </div>
          <p className="text-[11px] text-amber-700 mt-2">Case tracking, documents, liens and offers are managed in the Legal Case tab after registration (Phase 2).</p>
        </fieldset>
      )}

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
        <button type="submit" disabled={loading} className="btn-primary">{loading ? "Saving…" : `Create ${type === "legal" ? "Legal" : "Clinical"} Patient`}</button>
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
