import DriverDotForm from "@/components/enterprise/DriverDotForm";

export const dynamic = "force-dynamic";

export default async function DotKioskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = `/api/enterprise/dot/kiosk/${token}`;
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="font-bold">ProactiveClinics</span>
          <span className="text-xs text-white/60">Occupational Health · DOT Physical</span>
        </div>
      </header>
      <DriverDotForm loadUrl={base} submitUrl={base} heading="DOT Medical History (MCSA-5875)" />
    </div>
  );
}
