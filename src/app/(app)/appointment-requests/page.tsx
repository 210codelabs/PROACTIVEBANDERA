import Shell from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import AppointmentRequestsList from "@/components/AppointmentRequestsList";

export const dynamic = "force-dynamic";

export default async function AppointmentRequestsPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Appointment Requests">
      <div className="p-4">
        <p className="text-sm text-slate-500 mb-4">Website “request a visit” submissions. Confirm or decline; current-patient requests are flagged for priority check-in.</p>
        <AppointmentRequestsList />
      </div>
    </Shell>
  );
}
