"use client";
import { useState } from "react";

const GATHER: { label: string; hint: string }[] = [
  { label: "Legal entity name & Texas facility address", hint: "exactly as registered" },
  { label: "Authorized decision-maker / signer", hint: "name, title, email — will sign the EULA" },
  { label: "Compliance / privacy officer contact", hint: "name, email, phone" },
  { label: "Prescriber & pharmacist roster", hint: "full name, NPI, DEA #, role — each authorized user (no shared accounts)" },
  { label: "EHR product name & version", hint: "this platform — Proactive Clinic EHR" },
  { label: "Licensee determination", hint: "is the practice or the software company the PMP Gateway licensee?" },
  { label: "Estimated integration go-live date", hint: "and volume (providers / daily queries)" },
];

const STEPS: string[] = [
  "Review the Texas PMP Integration Welcome Packet (Texas State Board of Pharmacy).",
  "Authorized decision-maker submits the Bamboo Health Customer Connect integration request.",
  "Sign the EULA emailed by Bamboo Health.",
  "Complete the PMP Gateway Licensee Questionnaire.",
  "Receive the staging endpoint + client certificate (mTLS) and test identities.",
  "Register each authorized prescriber / pharmacist user with a permitted clinical purpose.",
  "Complete Bamboo staging tests + certificate validation, then request production approval.",
];

const CREDS = ["PMP_BASE_URL", "PMP_CLIENT_CERT", "PMP_CLIENT_KEY"];

const EMAIL = `Subject: Texas PMP (PMP Gateway) integration request — [Practice Legal Name]

Hello Bamboo Health team,

We are a Texas-licensed outpatient practice requesting integration with the Texas Prescription Monitoring Program via PMP Gateway / PMP InterConnect, to be accessed from our EHR (Proactive Clinic EHR) by our authorized prescribers and pharmacists.

Practice / entity: [Legal name, Texas facility address]
Authorized decision-maker (EULA signer): [Name, title, email]
Compliance contact: [Name, email, phone]
EHR product & version: Proactive Clinic EHR [version]
Licensee: [practice / software vendor]
Authorized users (name, NPI, DEA, role): [attach roster]
Target go-live: [date]; estimated volume: [providers / daily queries]

Please send the Integration Welcome Packet, the EULA, the PMP Gateway Licensee Questionnaire, the staging endpoint + client certificate (mTLS) details, connectivity/API specification, and the certification checklist.

We will not use any portal (AWARxE) login credentials for automated access; integration will use the mTLS certificate you provision.

Thank you,
[Your name / title / practice / phone]`;

export default function PmpOnboardingKit() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(EMAIL); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }
  return (
    <div className="space-y-4">
      <div className="card card-pad bg-brand-50 ring-1 ring-brand-100 text-sm text-brand-900 print:hidden">
        The Texas PMP is a <span className="font-semibold">gated</span> state database (no public developer sandbox). Use this kit to gather the required info
        and send the request to Bamboo Health. Once they provision your mTLS certificate, add the credentials below and the connector activates. Never use AWARxE portal logins for automation.
        <div className="mt-2 flex gap-2">
          <button onClick={copy} className="btn-primary py-1.5">{copied ? "Copied!" : "Copy request email"}</button>
          <button onClick={() => window.print()} className="btn-secondary py-1.5">Print checklist</button>
        </div>
      </div>

      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">1 · Information to gather</header>
        <ul className="p-4 space-y-2 text-sm">
          {GATHER.map((g, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded border border-slate-300 shrink-0" aria-hidden />
              <span><span className="font-medium text-slate-900">{g.label}</span> <span className="text-slate-500">— {g.hint}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">2 · Onboarding steps</header>
        <ol className="p-4 space-y-2 text-sm list-decimal list-inside text-slate-700">
          {STEPS.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </section>

      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">3 · Credentials to collect back (add to server env)</header>
        <div className="p-4 text-sm">
          <p className="text-slate-600 mb-2">Bamboo will provision an mTLS client certificate. Provide these to your administrator to activate the connector — they are stored server-side only, never in the browser:</p>
          <div className="flex flex-wrap gap-2">{CREDS.map((c) => <span key={c} className="chip bg-slate-100 text-slate-700 ring-slate-200 font-mono">{c}</span>)}</div>
        </div>
      </section>

      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Ready-to-send request email</header>
        <pre className="p-4 text-[12px] text-slate-700 whitespace-pre-wrap font-mono">{EMAIL}</pre>
      </section>

      <div className="text-xs text-slate-500">
        Official references: Texas State Board of Pharmacy · PMP Integration (<a className="text-brand-700 underline" target="_blank" rel="noreferrer" href="https://www.pharmacy.texas.gov/pmp/PMPIntegration.asp">pharmacy.texas.gov</a>) and Bamboo Health Customer Connect.
      </div>
    </div>
  );
}
