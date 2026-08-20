import { requireSession } from "@/lib/auth";
import AnalyticsBoard from "@/components/analytics/AnalyticsBoard";

export const dynamic = "force-dynamic";

/**
 * Frameless, branded presentation view of the analytics dashboard. Opens in a
 * new tab (no sidebar/app chrome) for use in a pitch/meeting or to export a PDF.
 * Still requires a staff session (enforced by middleware + requireSession).
 */
export default async function AnalyticsPresentPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; print?: string }> }) {
  const user = await requireSession();
  const sp = await searchParams;
  const now = new Date();
  const rangeLabel = `${sp.from || "last 12 months"}${sp.to ? "  –  " + sp.to : ""}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Branded header */}
      <header className="bg-gradient-to-r from-[#0a2540] to-[#0d9488] text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="ProactiveClinic" className="h-11 w-11 rounded-lg ring-1 ring-white/30 bg-black/20" />
          <div>
            <div className="text-lg font-bold tracking-tight">ProactiveClinic — Practice Analytics &amp; Insights</div>
            <div className="text-[12px] text-white/70">Comprehensive Wellness &amp; Recovery · Range: {rangeLabel}</div>
          </div>
          <div className="ml-auto text-right text-[11px] text-white/70">
            <div>Prepared by {user.firstName} {user.lastName}</div>
            <div>{now.toLocaleString()}</div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-5">
        <AnalyticsBoard mode="present" initialFrom={sp.from} initialTo={sp.to} autoPrint={sp.print === "1"} />
        <footer className="mt-6 text-center text-[10px] text-slate-400">
          ProactiveClinic — A Division of Proactive UMS Inc. · Confidential practice analytics. Demo build, not for clinical use.
        </footer>
      </main>

      {/* Print styling for clean PDF export */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          header { background: #0a2540 !important; }
        }
      `}</style>
    </div>
  );
}
