"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RefSelect from "@/components/RefSelect";
import PayerAutocomplete from "@/components/billing/PayerAutocomplete";

type Attorney = { id: string; name: string; firm: string | null; email: string };
type Summary = { label: string; value: string };
type EligCheck = {
  id: string;
  status: string;
  payerId: string;
  payerName?: string | null;
  planName?: string | null;
  memberId?: string | null;
  summary?: Summary[] | null;
  createdAt?: string;
};

const CASE_TYPES = [
  { value: "personal_injury", label: "Personal Injury (accident)" },
  { value: "auto_accident", label: "Auto Accident (MVA)" },
  { value: "workers_comp", label: "Workers' Compensation" },
  { value: "other", label: "Other / Legal referral" },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  inactive: "bg-slate-200 text-slate-700 ring-slate-300",
  error: "bg-rose-100 text-rose-800 ring-rose-200",
  unknown: "bg-amber-100 text-amber-800 ring-amber-200",
};

type PADraft = {
  serviceType: string;
  cptCodes: string;
  diagnosisCodes: string;
  units: string;
  startDate: string;
  endDate: string;
  notes: string;
};
const EMPTY_PA: PADraft = { serviceType: "", cptCodes: "", diagnosisCodes: "", units: "", startDate: "", endDate: "", notes: "" };

export default function NewPatientForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"clinical" | "legal">("clinical");
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [lawFirm, setLawFirm] = useState("");

  // Insurance / payer state
  const [payerId, setPayerId] = useState("");
  const [payerName, setPayerName] = useState("");

  // Eligibility (Stedi 270/271) state
  const [eligLoading, setEligLoading] = useState(false);
  const [eligError, setEligError] = useState<string | null>(null);
  const [eligResult, setEligResult] = useState<EligCheck | null>(null);
  const [autoVerify, setAutoVerify] = useState(true);
  const [insSig, setInsSig] = useState("");
  const lastVerifiedSig = useRef("");
  const eligCheckId = eligResult?.id ?? null;

  function readInsurance() {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const firstName = (fd?.get("firstName") as string) || "";
    const lastName = (fd?.get("lastName") as string) || "";
    const dob = (fd?.get("dob") as string) || "";
    const memberId = (fd?.get("memberId") as string) || "";
    const insurerName = (fd?.get("insurerName") as string) || payerName || "";
    return { firstName, lastName, dob, memberId, insurerName, sig: [payerId.trim(), firstName, lastName, dob, memberId].join("|") };
  }

  // Auto-verify: once payer + member + name are present, run a live eligibility
  // check automatically (debounced) so front desk doesn't have to click.
  useEffect(() => {
    if (!autoVerify || eligLoading) return;
    const { firstName, lastName, memberId, sig } = readInsurance();
    if (!payerId.trim() || !firstName || !lastName || !memberId) return;
    if (sig === lastVerifiedSig.current) return;
    const t = setTimeout(() => { lastVerifiedSig.current = sig; verifyCoverage(true); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insSig, payerId, autoVerify]);

  // Prior-authorization draft (manual tracker)
  const [paOpen, setPaOpen] = useState(false);
  const [pa, setPa] = useState<PADraft>(EMPTY_PA);

  useEffect(() => {
    if (type !== "legal" || attorneys.length) return;
    fetch("/api/attorneys")
      .then((r) => (r.ok ? r.json() : { attorneys: [] }))
      .then((d) => setAttorneys(d.attorneys || []))
      .catch(() => {});
  }, [type, attorneys.length]);

  async function verifyCoverage(auto = false) {
    if (eligLoading) return;
    setEligError(null);
    if (!auto) setEligResult(null);
    const { firstName, lastName, dob, memberId, insurerName, sig } = readInsurance();

    if (!payerId.trim()) { if (!auto) setEligError("Select a payer (or enter a Stedi payer ID) first."); return; }
    if (!firstName || !lastName) { if (!auto) setEligError("Enter the patient's first and last name first."); return; }
    lastVerifiedSig.current = sig;

    setEligLoading(true);
    try {
      const res = await fetch("/api/stedi/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerId: payerId.trim(),
          payerName: payerName || insurerName,
          memberId,
          firstName,
          lastName,
          dateOfBirth: dob,
        }),
      });
      const d = await res.json();
      if (d.check) setEligResult(d.check);
      if (d.error) setEligError(d.error);
      if (!d.check && !d.error) setEligError("No response from the eligibility service.");
    } catch {
      setEligError("Could not reach the eligibility service.");
    } finally {
      setEligLoading(false);
    }
  }

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
      const patientId = data.patient.id;

      // Attach a coverage check that was run before the patient existed.
      if (eligCheckId) {
        await fetch("/api/stedi/eligibility", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ checkId: eligCheckId, patientId }),
        }).catch(() => {});
      }

      // Create a linked prior-authorization request when the staff drafted one.
      const paHasContent = pa.serviceType || pa.cptCodes || pa.notes;
      if (paHasContent) {
        await fetch("/api/prior-auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            patientId,
            patientName: `${data.patient.lastName}, ${data.patient.firstName}`,
            payerId: payerId || null,
            payerName: payerName || (body.insurerName as string) || null,
            memberId: (body.memberId as string) || null,
            serviceType: pa.serviceType || null,
            cptCodes: pa.cptCodes || null,
            diagnosisCodes: pa.diagnosisCodes || null,
            units: pa.units || null,
            startDate: pa.startDate || null,
            endDate: pa.endDate || null,
            notes: pa.notes || null,
            status: "draft",
          }),
        }).catch(() => {});
      }

      router.push(`/patients/${patientId}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <form ref={formRef} onSubmit={onSubmit} onChange={() => setInsSig(readInsurance().sig)} className="card card-pad space-y-6 xl:col-span-2">
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
        <fieldset>
          <legend className="section-title mb-2">Insurance</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <RefSelect type="insurer" label="Insurer" name="insurerName" showCode={false} />
            <Field label="Plan" name="insurerPlan" />
            <Field label="Member ID" name="memberId" />
            <Field label="Group #" name="groupNumber" />
            <label className="block">
              <span className="label">Payer (search Stedi)</span>
              <PayerAutocomplete
                value={payerName}
                onChange={(v) => setPayerName(v)}
                onSelect={({ name, payerId }) => { setPayerName(name); setPayerId(payerId); }}
                placeholder="Type payer / insurer name…"
              />
              <span className="text-[11px] text-slate-500">Picking a match fills the Stedi payer ID below.</span>
            </label>
            <label className="block">
              <span className="label">Stedi payer ID</span>
              <input className="input" value={payerId} onChange={(e) => setPayerId(e.target.value)} placeholder="e.g. 87726" />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => verifyCoverage(false)} disabled={eligLoading} className="btn-secondary w-full">
                {eligLoading ? "Verifying…" : "Verify coverage"}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">Real-time Stedi eligibility (270/271). Results appear in the Coverage panel and stay linked to the patient after registration.</p>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <input type="checkbox" checked={autoVerify} onChange={(e) => setAutoVerify(e.target.checked)} />
              Auto-verify {autoVerify && eligLoading && <span className="text-brand-600">· checking…</span>}
            </label>
          </div>
        </fieldset>

        {error && <div className="rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "Saving…" : `Create ${type === "legal" ? "Legal" : "Clinical"} Patient`}</button>
        </div>
      </form>

      {/* Right pane: coverage + prior authorization */}
      <aside className="space-y-4 xl:sticky xl:top-4">
        <div className="card card-pad">
          <h3 className="section-title mb-2">Coverage &amp; benefits</h3>
          {!eligResult && !eligError && (
            <p className="text-sm text-slate-500">
              Enter the payer + member ID and coverage <span className="font-medium text-slate-700">auto-verifies</span> (or click <span className="font-medium text-slate-700">Verify coverage</span>). The result stays linked to the patient chart after registration.
            </p>
          )}
          {eligError && (
            <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{eligError}</div>
          )}
          {eligResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ring-1 ${STATUS_STYLE[eligResult.status] || STATUS_STYLE.unknown}`}>{String(eligResult.status).toUpperCase()}</span>
                <span className="text-sm font-medium text-slate-800">{eligResult.payerName || eligResult.payerId}</span>
                {eligResult.planName && <span className="text-xs text-slate-500">· {eligResult.planName}</span>}
              </div>
              <dl className="grid grid-cols-1 gap-y-1 text-sm">
                {eligResult.memberId && (
                  <div className="flex justify-between"><dt className="text-slate-500">Member ID</dt><dd className="font-medium text-slate-800">{eligResult.memberId}</dd></div>
                )}
                {Array.isArray(eligResult.summary) && eligResult.summary.map((s, i) => (
                  <div key={i} className="flex justify-between gap-4"><dt className="text-slate-500">{s.label}</dt><dd className="font-medium text-slate-800 text-right">{s.value}</dd></div>
                ))}
              </dl>
              {eligResult.status === "active" && (
                <p className="text-[11px] text-emerald-700">Active coverage confirmed by the payer. Saved to the patient after registration.</p>
              )}
              {(eligResult.status === "inactive" || eligResult.status === "error") && (
                <p className="text-[11px] text-slate-500">Coverage could not be confirmed for the details entered. Verify the member ID / payer and try again.</p>
              )}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Prior authorization</h3>
            <button type="button" onClick={() => setPaOpen((v) => !v)} className="text-xs font-medium text-brand-600 hover:underline">
              {paOpen ? "Hide" : "Add request"}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Manual tracker. Obtain the authorization via the payer portal/phone, then record it here — it links to the patient chart. Not submitted electronically.
          </p>
          {paOpen && (
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="label">Service / procedure</span>
                <input className="input" value={pa.serviceType} onChange={(e) => setPa({ ...pa, serviceType: e.target.value })} placeholder="e.g. PT evaluation, MRI lumbar" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="label">CPT/HCPCS</span>
                  <input className="input" value={pa.cptCodes} onChange={(e) => setPa({ ...pa, cptCodes: e.target.value })} placeholder="97161, 97110" />
                </label>
                <label className="block text-sm">
                  <span className="label">Diagnosis (ICD-10)</span>
                  <input className="input" value={pa.diagnosisCodes} onChange={(e) => setPa({ ...pa, diagnosisCodes: e.target.value })} placeholder="M54.5" />
                </label>
                <label className="block text-sm">
                  <span className="label">Units / visits</span>
                  <input className="input" type="number" min={0} value={pa.units} onChange={(e) => setPa({ ...pa, units: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="label">Start date</span>
                  <input className="input" type="date" value={pa.startDate} onChange={(e) => setPa({ ...pa, startDate: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <span className="label">End date</span>
                  <input className="input" type="date" value={pa.endDate} onChange={(e) => setPa({ ...pa, endDate: e.target.value })} />
                </label>
              </div>
              <label className="block text-sm">
                <span className="label">Notes</span>
                <textarea className="input min-h-[64px]" value={pa.notes} onChange={(e) => setPa({ ...pa, notes: e.target.value })} placeholder="Payer reference #, reviewer name, etc." />
              </label>
              <p className="text-[11px] text-slate-500">This request will be created and linked to the patient when you submit the registration.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
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
