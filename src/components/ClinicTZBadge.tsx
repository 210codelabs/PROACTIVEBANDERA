import { CLINIC_HOURS_LABEL } from "@/lib/clinic";

/**
 * Small, self-contained "All times Central (CT)" badge for schedule/booking
 * screens so staff and patients are never confused about the timezone.
 */
export default function ClinicTZBadge({ className = "", showHours = false }: { className?: string; showHours?: boolean }) {
  return (
    <span
      title={`Clinic timezone: US Central Time. Hours: ${CLINIC_HOURS_LABEL}`}
      className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 px-2.5 py-1 text-[11px] font-medium ${className}`}
    >
      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v5l3 2" />
      </svg>
      All times Central (CT){showHours ? <span className="text-slate-400">· 9 AM–8 PM</span> : null}
    </span>
  );
}
