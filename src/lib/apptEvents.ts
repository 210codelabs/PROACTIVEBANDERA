// Plain (non-"use client") shared module so any client component can open the
// global floating Appointment widget or announce a change. No React/DOM at
// import time — window is only touched inside the helpers at call time.

export const APPT_OPEN = "appt:open";
export const APPT_CHANGED = "appt:changed";
export const DAY_AGENDA_OPEN = "day-agenda:open";

export type DayAgendaDetail = {
  day: string;          // yyyy-MM-dd
  providerId?: string;  // optional preselected provider
};

export function openDayAgenda(detail: DayAgendaDetail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DAY_AGENDA_OPEN, { detail }));
}

export type ApptOpenDetail = {
  mode: "new" | "edit";
  day?: string;          // yyyy-MM-dd
  time?: string;         // HH:mm
  providerId?: string;
  serviceTypeId?: string;
  patientId?: string;
  patientName?: string;
  appointmentId?: string; // edit mode
  seriesId?: string;      // set when the appointment is part of a recurring series
  reason?: string;
  location?: string;
  durationMin?: number;
};

export function openApptWidget(detail: ApptOpenDetail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(APPT_OPEN, { detail }));
}

export function notifyApptChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(APPT_CHANGED));
}
