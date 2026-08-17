import Link from "next/link";
import { GUIDE_SECTIONS } from "@/lib/guide/content";

export default function GuideIndex() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200 bg-gradient-to-br from-brand-800 to-brand-600 text-white">
        <img src="/guide/img/clinical.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative p-6 sm:p-10">
          <span className="chip bg-white/15 text-white ring-white/30">Complete User Guide</span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold">Everything you need to run Proactive Clinic</h1>
          <p className="mt-2 max-w-2xl text-brand-50">Step-by-step help for the front desk, providers and billing team — scheduling, charting, claims, portals, records and more. Each section includes real screenshots from the app.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/api/guide/pdf?download=1" className="inline-flex items-center gap-2 rounded-full bg-white text-brand-700 font-bold px-5 py-2.5 hover:bg-brand-50">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
              Download the PDF guide
            </a>
            <Link href={`/guide/${GUIDE_SECTIONS[0].slug}`} className="inline-flex items-center rounded-full ring-1 ring-white/50 text-white font-bold px-5 py-2.5 hover:bg-white/10">Start reading →</Link>
          </div>
        </div>
      </section>

      {/* Section grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GUIDE_SECTIONS.map((s, i) => (
          <Link key={s.slug} href={`/guide/${s.slug}`} className="group rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden hover:ring-brand-300 hover:shadow-md transition">
            <div className="relative h-32">
              <img src={s.hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2 text-white">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-sm font-bold">{i + 1}</span>
                <span className="font-bold drop-shadow">{s.title}</span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600">{s.summary}</p>
              {s.audience && <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-600">For: {s.audience}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
