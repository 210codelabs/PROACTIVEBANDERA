import Link from "next/link";
import ScheduleForm from "@/components/ScheduleForm";

export const dynamic = "force-dynamic";

// PUBLIC scheduling page (no auth required).
export default function BookPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-brand-800 to-brand-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Schedule a Visit</h1>
            <p className="text-brand-100 mt-1">Request an appointment online. New and current patients welcome.</p>
          </div>
          <Link href="/" className="chip bg-white/15 text-white ring-white/30 hover:bg-white/25">← Home</Link>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <ScheduleForm />
      </div>
    </main>
  );
}
