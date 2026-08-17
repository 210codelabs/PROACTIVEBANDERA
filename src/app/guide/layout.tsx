import Link from "next/link";
import GuideNav from "@/components/guide/GuideNav";

export const metadata = {
  title: "User Guide — Proactive Clinic",
  description: "Complete user guide for the Proactive Clinic EHR/EMR platform: scheduling, charting, billing, claims, portals, records and more.",
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/guide" className="flex items-center gap-3 min-w-0">
            <img src="/pclinic-header.png?v=2" alt="Proactive Clinic" className="h-9 w-auto object-contain" />
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline font-semibold text-slate-700 whitespace-nowrap">User Guide</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href="/api/guide/pdf?download=1" className="inline-flex items-center gap-2 rounded-full bg-brand-700 hover:bg-brand-800 text-white text-sm font-bold px-4 py-2 whitespace-nowrap">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
              Download PDF
            </a>
            <Link href="/login" className="hidden sm:inline-flex items-center rounded-full ring-1 ring-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold px-4 py-2 whitespace-nowrap">Open EMR</Link>
            <Link href="/" className="inline-flex items-center rounded-full ring-1 ring-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold px-3 py-2 whitespace-nowrap">Home</Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <GuideNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
