"use client";

import { useEffect, useState } from "react";
import { CLINIC_LOCATIONS } from "@/lib/clinicLocations";
import { formatClinic } from "@/lib/clinic";

type Appointment = { id: string; employeeName: string; startsAt: string; status: string };
type Slot = { time: string; available: boolean };

export default function EnterpriseCalendar({ enterpriseId }: { enterpriseId?: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [location, setLocation] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const query = enterpriseId ? `?enterpriseId=${encodeURIComponent(enterpriseId)}` : "";
    const response = await fetch(`/api/enterprise/appointments${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load appointments.");
    const result = await response.json();
    setAppointments(result.appointments);
    setEmployees(result.employees);
  }
  useEffect(() => { setAppointments([]); setEmployees([]); setEmployeeId(""); load().catch(() => setError("Could not load appointments.")); }, [enterpriseId]);
  useEffect(() => {
    setSlots([]);
    if (!day) return;
    const controller = new AbortController();
    fetch(`/api/appointments/request/availability?day=${encodeURIComponent(day)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((result) => setSlots(result.slots))
      .catch(() => { if (!controller.signal.aborted) setError("Availability is temporarily unavailable."); });
    return () => controller.abort();
  }, [day]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/enterprise/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enterpriseId, employeeId, location, day, time }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not reserve appointment.");
      setTime("");
      await load();
      const refreshed = await fetch(`/api/appointments/request/availability?day=${encodeURIComponent(day)}`, { cache: "no-store" });
      if (refreshed.ok) setSlots((await refreshed.json()).slots);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not reserve appointment."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card card-pad space-y-4">
      <h2 className="font-semibold text-slate-900">Employee appointments</h2>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Employee<select required className="input mt-1" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label className="text-sm">Clinic<select required className="input mt-1" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Select clinic</option>{CLINIC_LOCATIONS.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name} - {clinic.street}</option>)}</select></label>
        <label className="text-sm">Date<input required type="date" className="input mt-1" value={day} onChange={(event) => { setDay(event.target.value); setTime(""); }} /></label>
        <label className="text-sm">Time (Central)<select required className="input mt-1" value={time} onChange={(event) => setTime(event.target.value)}><option value="">Select time</option>{slots.map((slot) => <option key={slot.time} value={slot.time} disabled={!slot.available}>{slot.time}{slot.available ? "" : " - Booked"}</option>)}</select></label>
        <button className="btn-primary sm:col-span-2 lg:col-span-1" disabled={busy}>{busy ? "Booking..." : "Book appointment"}</button>
      </form>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {appointments.length === 0 ? <p className="text-sm text-slate-500">No appointments booked by your company.</p> : (
        <ul className="divide-y divide-slate-200">{appointments.map((appointment) => <li key={appointment.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="font-medium">{appointment.employeeName}</span><span>{formatClinic(appointment.startsAt)} CT</span><span className="capitalize">{appointment.status}</span></li>)}</ul>
      )}
    </section>
  );
}