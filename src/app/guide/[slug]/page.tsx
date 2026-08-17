import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDE_SECTIONS, getSection } from "@/lib/guide/content";
import GuideBlocks from "@/components/guide/GuideBlocks";

export function generateStaticParams() {
  return GUIDE_SECTIONS.map((s) => ({ slug: s.slug }));
}

export default async function GuideSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const section = getSection(slug);
  if (!section) notFound();

  const idx = GUIDE_SECTIONS.findIndex((s) => s.slug === slug);
  const prev = idx > 0 ? GUIDE_SECTIONS[idx - 1] : null;
  const next = idx < GUIDE_SECTIONS.length - 1 ? GUIDE_SECTIONS[idx + 1] : null;

  return (
    <article className="space-y-6">
      <div className="text-xs text-slate-500">
        <Link href="/guide" className="hover:underline">User Guide</Link> <span className="mx-1">/</span> <span className="text-slate-700">{section.title}</span>
      </div>

      {/* Section hero */}
      <header className="relative overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <img src={section.hero} alt="" className="h-44 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={section.icon} /></svg>
            </span>
            <h1 className="text-2xl font-extrabold drop-shadow">{section.title}</h1>
          </div>
          <p className="mt-1 max-w-2xl text-white/90 text-sm">{section.summary}</p>
          {section.audience && <span className="mt-2 inline-block chip bg-white/15 text-white ring-white/30">For: {section.audience}</span>}
        </div>
      </header>

      <GuideBlocks blocks={section.blocks} />

      {/* Prev / next */}
      <nav className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
        {prev ? (
          <Link href={`/guide/${prev.slug}`} className="group rounded-xl ring-1 ring-slate-200 bg-white px-4 py-3 hover:ring-brand-300 transition max-w-[48%]">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">← Previous</div>
            <div className="font-semibold text-slate-800 truncate">{prev.title}</div>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/guide/${next.slug}`} className="group rounded-xl ring-1 ring-slate-200 bg-white px-4 py-3 hover:ring-brand-300 transition text-right max-w-[48%]">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Next →</div>
            <div className="font-semibold text-slate-800 truncate">{next.title}</div>
          </Link>
        ) : <span />}
      </nav>
    </article>
  );
}
