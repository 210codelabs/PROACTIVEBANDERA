import Link from "next/link";

export const metadata = {
  title: "Proactive Clinic — Practice Fusion (Veradigm) FHIR Integration",
  description: "Server-to-server clinical data migration from Practice Fusion using SMART Backend Services and FHIR Bulk Data $export.",
};

// PUBLIC page. Used as the "Additional info link / website" for the Veradigm
// FHIR App registration, and as a plain-language description of how the
// integration accesses data.
export default function VeradigmInfoPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Proactive Clinic · FHIR Integration</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Practice Fusion (Veradigm) data migration</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Proactive Clinic operates an unattended, server-to-server integration that retrieves
            authorized Practice Fusion clinical data using <strong>SMART Backend Services</strong>
            (OAuth 2.0 <code>client_credentials</code> with an asymmetric, signed JWT) and
            <strong> FHIR R4 Bulk Data <code>$export</code></strong>. It is used to migrate a
            practice&rsquo;s records into that practice&rsquo;s own Proactive Clinic environment for
            continuity of care.
          </p>

          <h2 className="mt-8 text-sm font-semibold text-slate-900">How access works</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-600 list-disc pl-5">
            <li>No clinician or patient username/password is ever used or stored.</li>
            <li>Authentication uses a signed JWT verified against our public key set (JWKS).</li>
            <li>We request least-privilege, read-only scopes (<code>system/*.read</code>).</li>
            <li>Data is only retrieved after the customer activates and authorizes the app.</li>
            <li>Retrieved data is stored securely in the authorized customer environment.</li>
          </ul>

          <h2 className="mt-8 text-sm font-semibold text-slate-900">Resources imported</h2>
          <p className="mt-2 text-sm text-slate-600">
            Patient, Condition, MedicationRequest/Statement, AllergyIntolerance, Observation
            (vital signs), Immunization, Encounter, and DocumentReference.
          </p>

          <h2 className="mt-8 text-sm font-semibold text-slate-900">Public key set (JWKS)</h2>
          <p className="mt-2 text-sm text-slate-600 break-all">
            <a className="text-brand-600 hover:underline" href="/api/fhir/jwks/veradigm">https://proactiveclinics.com/api/fhir/jwks/veradigm</a>
          </p>

          <h2 className="mt-8 text-sm font-semibold text-slate-900">Security &amp; privacy contact</h2>
          <p className="mt-2 text-sm text-slate-600">
            For security, privacy, or data-use questions, contact your Proactive Clinic administrator.
          </p>

          <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <Link href="/" className="hover:underline">← Back to Proactive Clinic</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
