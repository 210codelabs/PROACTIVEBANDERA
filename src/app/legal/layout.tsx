import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/"><img src="/pclinic-light.png" alt="Proactive Clinic" className="h-14 w-auto object-contain" /></Link>
          <Link href="/" className="text-sm font-semibold text-brand-700 hover:text-brand-900">&larr; Back to home</Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-brand-950 text-slate-400 text-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-1">
          <div className="text-slate-300 font-semibold">Proactive Clinic — A Division of Proactive UMS Inc.</div>
          <div>8103 Bandera Rd, Suite 102, San Antonio, TX 78250 · (210) 500-2914 · info@proactiveclinic.com</div>
          <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/legal/privacy" className="hover:text-brand-300">Privacy Policy</Link>
            <Link href="/legal/terms" className="hover:text-brand-300">Terms of Use</Link>
            <Link href="/legal/hipaa" className="hover:text-brand-300">HIPAA Notice</Link>
            <Link href="/legal/accessibility" className="hover:text-brand-300">Accessibility</Link>
            <Link href="/legal/cookies" className="hover:text-brand-300">Cookie Policy</Link>
          </div>
          <div className="pt-2">&copy; {new Date().getFullYear()} Proactive UMS Inc. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
