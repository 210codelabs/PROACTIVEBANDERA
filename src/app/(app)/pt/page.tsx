import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function PtHubPage() {
  const user = await requireSession();
  let legalPatients = 0, notesTotal = 0, notesSigned = 0, intakes = 0;
  try {
    [legalPatients, notesTotal, notesSigned, intakes] = await Promise.all([
      db.patient.count({ where: { patientType: "legal" } }),
      db.ptNote.count(),
      db.ptNote.count({ where: { status: "signed" } }),
      db.piIntake.count(),
    ]);
  } catch { /* ignore */ }

  const cards = [
    { href: "/pt/encounters", title: "PT Encounters", desc: "Create & sign Personal Injury encounter notes (PIP / auto).", stat: `${notesTotal} notes · ${notesSigned} signed`, tone: "indigo" },
    { href: "/pt/intake", title: "PI Intake", desc: "Legally-formatted accident intake that flows into the PI note.", stat: `${intakes} intakes`, tone: "violet" },
    { href: "/pt/claims", title: "PT Claims", desc: "Submit CMS-1500 style claims to auto / casualty payers via Stedi.", stat: `${notesSigned} ready`, tone: "emerald" },
    { href: "/pt/reporting", title: "Reporting", desc: "Volumes, signed vs draft, by auto insurer, monthly trend.", stat: `${legalPatients} PI patients`, tone: "amber" },
    { href: "/settings/casualty-payers", title: "Casualty Payers", desc: "Find & save auto / PIP payers (Stedi) used for PT claims.", stat: "Setup & enrollment", tone: "sky" },
    { href: "/settings/pt-fees", title: "Fee Schedule", desc: "Set default charge per PT CPT so claims auto-fill dollars.", stat: "Charge master", tone: "rose" },
  ];
  const toneMap: Record<string, string> = {
    indigo: "border-l-indigo-500", violet: "border-l-violet-500", emerald: "border-l-emerald-500", amber: "border-l-amber-500", sky: "border-l-sky-500", rose: "border-l-rose-500",
  };

  return (
    <Shell user={user}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900">Physical Rehab — Personal Injury</h1>
        <p className="text-sm text-slate-500">Dedicated PIP / auto-injury workspace: intake, encounter notes, claims and reporting in one place.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} prefetch={false} className={`card card-interactive border-l-4 ${toneMap[c.tone]} p-4 hover:shadow-md transition-shadow`}>
              <div className="font-semibold text-slate-900">{c.title}</div>
              <div className="text-sm text-slate-500 mt-0.5">{c.desc}</div>
              <div className="text-[11px] font-semibold text-slate-400 mt-2">{c.stat}</div>
            </Link>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-800">
          <b>Note:</b> AI dictation & note normalization are enabled in the PT encounter editor (review drafts before signing). Live claim submission runs through the <b>Stedi</b> clearinghouse to the auto/casualty payer and stays gated until that payer&apos;s claims enrollment is confirmed on your Stedi account.
        </div>
      </div>
    </Shell>
  );
}
