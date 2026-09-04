import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Weno e-Prescribing in-app guide. Satisfies Weno EZ Integration Test Plan:
//   Section 8 — My Drug App (patient text-message notice)
//   Section 9 — Explain WENO Online to prescribers / users
//   Section 6 — Patient check-in flag guidance (alternative pharmacy)
export default async function WenoGuidePage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Weno e-Prescribing — Guide">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          How e-prescribing works at Clínica Familiar Bandera, for prescribers, staff and patients.
        </span>
        <Link href="/erx" className="text-sm text-brand-700 hover:underline">← Back to e-Prescribe</Link>
      </div>

      {/* Section 9 — Explain WENO Online to prescribers/users */}
      <section className="card mb-4">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
          For Prescribers &amp; Staff — Using WENO Online
        </header>
        <div className="p-4 space-y-3 text-sm text-slate-700">
          <p>
            We e-prescribe through <strong>WENO Online</strong> using the secure <strong>ComposeRx</strong> screen,
            launched directly inside this EHR (no separate login). WENO transmits the prescription electronically to
            the patient&apos;s chosen pharmacy.
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open the patient chart → <strong>Medications</strong>.</li>
            <li>Confirm the patient&apos;s <strong>Primary pharmacy</strong> (Demographics → Preferred Pharmacy).</li>
            <li>Click <strong>e-Prescribe (Weno)</strong> to open the ComposeRx screen embedded in the EHR.</li>
            <li>Select the drug, sig, quantity and refills, then sign &amp; send.</li>
            <li>Use <strong>Sync from Weno</strong> (or the scheduled sync) to pull the sent prescription back into the
              patient&apos;s Medication List; view all activity in <Link href="/erx/rxlog" className="text-brand-700 hover:underline">Rx Log</Link>.</li>
          </ol>
          <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 px-3 py-2 text-xs text-slate-600">
            A prescriber account is required to open ComposeRx. Nurses and front-desk staff can manage the patient&apos;s
            pharmacy and demographics but cannot sign a prescription.
          </div>
        </div>
      </section>

      {/* Section 8 — My Drug App */}
      <section className="card mb-4">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
          For Patients — The &quot;My Drug&quot; App &amp; Text Messages
        </header>
        <div className="p-4 space-y-3 text-sm text-slate-700">
          <p>
            When a prescription is sent through WENO, the patient may receive <strong>text messages</strong> from
            WENO&apos;s <strong>&quot;My Drug&quot; App</strong> program (for example, savings information or pharmacy
            notifications) unless they choose to opt out.
          </p>
          <p className="font-semibold text-slate-800">What we tell every patient at check-in:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your prescription is sent electronically through WENO to your pharmacy.</li>
            <li>You may receive text messages about your medication unless you opt out.</li>
            <li>You can opt out at any time by replying <strong>STOP</strong> to the message.</li>
            <li>Message &amp; data rates may apply; we never sell your information.</li>
          </ul>
          <div className="rounded-md bg-teal-50 ring-1 ring-teal-200 px-3 py-2 text-xs text-teal-800">
            This notice is presented to the patient during intake/check-in and is available in English and Spanish
            (Hablamos Español).
          </div>
        </div>
      </section>

      {/* Section 6 — Patient check-in flag */}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
          Check-in Flag — WENO-Connected Alternative Pharmacy
        </header>
        <div className="p-4 space-y-3 text-sm text-slate-700">
          <p>
            If a patient&apos;s pharmacy is not WENO-connected, staff can raise a <strong>check-in flag</strong> so the
            patient is prompted to choose a WENO-connected alternative pharmacy at their next visit or encounter.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Open the patient chart → <strong>Demographics</strong> → <strong>Preferred Pharmacy (e-Prescribing)</strong>.</li>
            <li>Tick <strong>&quot;Needs a WENO-connected alternative pharmacy&quot;</strong> — an amber
              <span className="mx-1 chip bg-amber-100 text-amber-800 ring-amber-200">Check-in follow-up</span> badge appears.</li>
            <li>At the next check-in, front-desk staff select a WENO-connected pharmacy and clear the flag.</li>
          </ul>
        </div>
      </section>

      {/* CancelRx (Approved / Denied) — performed in Weno Online */}
      <section className="card mt-4">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
          Cancelling a Prescription (CancelRx) — Approved &amp; Denied
        </header>
        <div className="p-4 space-y-3 text-sm text-slate-700">
          <p>
            In the Weno EZ Integration, a <strong>CancelRx is sent from Weno Online</strong> (there is no separate button in
            this EHR). After you cancel in Weno, click <strong>Sync from Weno</strong> on the patient&apos;s Medications tab and
            the chart updates automatically based on the pharmacy&apos;s response.
          </p>

          <div className="rounded-lg ring-1 ring-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="font-semibold text-emerald-800">Approved cancel (pharmacy accepts the cancel)</div>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-emerald-900/90">
              <li>Send a test NewRx from ComposeRx to pharmacy NCPDP <code className="bg-white/70 px-1 rounded">TestWOLPendingPharmacy</code>.</li>
              <li>In Weno Online (Rx Log), open that Rx and choose <strong>Cancel</strong>.</li>
              <li>In the CancelRx header, set <code className="bg-white/70 px-1 rounded">RxReferenceNumber = EXPECTED_CANCELRX_APPROVED</code>.</li>
              <li>Back in the EHR, click <strong>Sync from Weno</strong> — the drug shows as <strong>cancelled</strong> in the Medication List.</li>
            </ol>
          </div>

          <div className="rounded-lg ring-1 ring-amber-200 bg-amber-50 px-3 py-2">
            <div className="font-semibold text-amber-800">Denied cancel (patient already picked it up)</div>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-amber-900/90">
              <li>Send a test NewRx from ComposeRx to pharmacy NCPDP <code className="bg-white/70 px-1 rounded">TestWOLPendingPharmacy</code>.</li>
              <li>In Weno Online (Rx Log), open that Rx and choose <strong>Cancel</strong>.</li>
              <li>In the CancelRx header, set <code className="bg-white/70 px-1 rounded">RxReferenceNumber = EXPECTED_CANCELRX_DENIED</code>.</li>
              <li>Click <strong>Sync from Weno</strong> — because the pharmacy denied the cancel, the drug remains <strong>active/prescribed</strong> in the chart.</li>
            </ol>
          </div>

          <p className="text-xs text-slate-500">
            Note: in real use there is a time delay between the cancel request and the pharmacy&apos;s response; in the Weno TEST
            environment the response is immediate. Always confirm the chart matches the Sync Report after cancelling.
          </p>
        </div>
      </section>
    </Shell>
  );
}
