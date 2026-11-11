"use client";

import { useRef, useState } from "react";
import ScheduleForm from "@/components/ScheduleForm";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function BookingButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const { locale } = useI18n();
  const title = locale === "es" ? "Reservar una cita" : "Book an appointment";

  return (
    <>
      <button type="button" className={className} onClick={() => { setOpen(true); dialogRef.current?.showModal(); }}>
        {children}
      </button>
      <dialog ref={dialogRef} onClose={() => setOpen(false)} aria-label={title} className="max-h-[90vh] w-[min(96vw,64rem)] max-w-none rounded-lg p-0 shadow-2xl backdrop:bg-black/60">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label={locale === "es" ? "Cerrar" : "Close booking"} className="rounded px-3 py-1 text-xl text-slate-600 hover:bg-slate-100">×</button>
        </div>
        {open && <div className="bg-slate-50 p-4 sm:p-6"><ScheduleForm lang={locale} /></div>}
      </dialog>
    </>
  );
}