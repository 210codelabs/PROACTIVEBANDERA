import PortalShell from "@/components/portal/PortalShell";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";

export default async function PortalAppointmentsPage() {
  const session = await requirePortalSession();
  let appointments: Array<{ id: string; startsAt: Date; serviceType: { name: string } | null; reason: string | null; provider: { firstName: string; lastName: string }; location: string | null; status: string }> = [];
  let dataUnavailable = false;

  try {
    appointments = await db.appointment.findMany({
      where: { patientId: session.patientId },
      include: { provider: true, serviceType: true },
      orderBy: { startsAt: "desc" },
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PortalShell session={session} active="/portal/appointments">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Appointments are temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-sm sm:text-base">Your Appointments</header>
        {appointments.length === 0 ? (
          <div className="p-4 text-xs sm:text-sm text-slate-500">No appointments yet.</div>
        ) : (
          <>
            {/* MOBILE VIEW */}
            <div className="sm:hidden space-y-3 p-3">
              {appointments.map((a) => (
                <div key={a.id} className="rounded-md ring-1 ring-slate-200 p-3 space-y-1.5">
                  <div className="font-medium text-sm text-slate-900">{new Date(a.startsAt).toLocaleString()}</div>
                  <div className="text-xs text-slate-700">{a.serviceType?.name || a.reason || "Visit"}</div>
                  <div className="text-xs text-slate-600">{a.provider.firstName} {a.provider.lastName}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{a.location || "In-office"}</span>
                    <span className={`chip ${a.status === "completed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : a.status === "cancelled" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE */}
            <table className="data hidden sm:w-full">
              <thead>
                <tr>
                  <th className="text-xs sm:text-sm">Date</th>
                  <th className="text-xs sm:text-sm">Provider</th>
                  <th className="text-xs sm:text-sm">Service</th>
                  <th className="text-xs sm:text-sm">Status</th>
                  <th className="text-xs sm:text-sm">Location</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td className="text-xs sm:text-sm">{new Date(a.startsAt).toLocaleString()}</td>
                    <td className="text-xs sm:text-sm">{a.provider.firstName} {a.provider.lastName}</td>
                    <td className="text-xs sm:text-sm">{a.serviceType?.name || a.reason || "Visit"}</td>
                    <td className="text-xs sm:text-sm">{a.status}</td>
                    <td className="text-xs sm:text-sm">{a.location || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </PortalShell>
  );
}
