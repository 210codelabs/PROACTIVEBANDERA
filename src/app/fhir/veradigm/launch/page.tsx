import Link from "next/link";

export const metadata = {
  title: "Proactive Clinic — Veradigm SMART Launch",
  description: "This is a system (Backend Services) application and does not use an interactive SMART launch.",
};

// PUBLIC page. Registered as the SMART "Launch URL" for the Veradigm FHIR App.
// This integration is a System / Bulk Data ($export) app that authenticates
// directly with client_credentials, so it does NOT use an interactive EHR/SMART
// launch. This page exists so the registered Launch URL resolves to a real,
// informative page rather than a dead link.
export default function VeradigmLaunchPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-8 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Proactive Clinic · SMART Launch</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">System application — no interactive launch</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            This Practice Fusion (Veradigm) integration is a <strong>System / Backend Services</strong>
            application that uses FHIR Bulk Data <code>$export</code> with a signed-JWT
            <code> client_credentials</code> grant. It authenticates server-to-server and does
            <strong> not</strong> use an interactive SMART App Launch.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Migrations are started by an authorized administrator inside Proactive Clinic.
          </p>
          <div className="mt-6">
            <Link href="/fhir/veradigm" className="text-brand-600 hover:underline text-sm">About this integration →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
