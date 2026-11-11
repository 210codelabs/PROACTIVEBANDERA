"use client";

import BookingButton from "@/components/BookingButton";

import React, { useEffect, useMemo, useState } from "react";
import MapNav from "@/components/MapNav";
import { CLINIC_LOCATIONS, closestClinic, milesBetween, telHref, type ClinicLocation } from "@/lib/clinicLocations";

type L = {
  location: string; // "Closest Clinic"
  ourClinics: string;
  selectedClinic: string;
  findingClinic: string;
  milesAway: string; // "{n} mi away"
  navigateTo: string;
  useMyLocation: string;
  phone: string;
  hours: string;
  hoursWeek: string;
  hoursSat: string;
  hoursSun: string;
  insuranceTitle: string;
  insuranceDesc: string;
  scheduleVisit: string;
  bookHere: string;
};

const PIN = "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z";
const PIN2 = "M15 11a3 3 0 11-6 0 3 3 0 016 0z";
const PHONE = "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z";
const CLOCK = "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z";

function Emblem({ d, d2 }: { d: string; d2?: string }) {
  return (
    <span className="relative inline-grid h-14 w-14 rounded-2xl shrink-0 place-items-center bg-white ring-1 ring-slate-200/70 shadow-[0_14px_30px_-12px_rgba(2,6,23,0.4)]">
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-brand-500/12 via-transparent to-red-500/12" />
      <svg className="relative h-7 w-7" fill="none" viewBox="0 0 24 24" aria-hidden>
        <path stroke="url(#pcIconGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d} />
        {d2 && <path stroke="url(#pcIconGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d2} />}
      </svg>
    </span>
  );
}

const Phones = ({ c, className = "" }: { c: ClinicLocation; className?: string }) => (
  <div className={`space-y-0.5 ${className}`}>
    {c.phones.map((p) => (
      <a key={p} href={telHref(p)} className="block text-sm text-brand-700 font-medium hover:underline">{p}</a>
    ))}
  </div>
);

type Geo = { state: "detecting" } | { state: "found"; closestId: string; miles: number } | { state: "denied" };

export default function ClosestClinicContact({ L }: { L: L }) {
  const [geo, setGeo] = useState<Geo>({ state: "detecting" });
  const [selectedId, setSelectedId] = useState<string>("sa-bandera");
  const [distances, setDistances] = useState<Record<string, number>>({});

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeo({ state: "denied" }); return; }
    setGeo({ state: "detecting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const { clinic, miles } = closestClinic(here);
        const d: Record<string, number> = {};
        for (const c of CLINIC_LOCATIONS) d[c.id] = Math.round(milesBetween(here, c));
        setDistances(d);
        setSelectedId(clinic.id);
        setGeo({ state: "found", closestId: clinic.id, miles });
      },
      () => setGeo({ state: "denied" }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  // Ask automatically when the page opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { locate(); }, []);

  const selected = useMemo(() => CLINIC_LOCATIONS.find((c) => c.id === selectedId) || CLINIC_LOCATIONS[3], [selectedId]);
  const mapClinic = useMemo(
    () => ({ lat: selected.lat, lng: selected.lng, address: selected.address, label: `Proactive Clinic — ${selected.address}`, name: selected.name }),
    [selected],
  );
  const isClosest = geo.state === "found" && geo.closestId === selected.id;
  const mi = (id: string) => (distances[id] != null ? L.milesAway.replace("{n}", String(distances[id])) : null);

  return (
    <>
      {geo.state === "found" ? (
        <div className="grid md:grid-cols-3 gap-6" data-testid="closest-clinic-cards">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="mx-auto mb-4 w-fit"><Emblem d={PIN} d2={PIN2} /></div>
            <h3 className="font-bold text-brand-900 mb-1" data-testid="closest-clinic-title">{isClosest ? L.location : L.selectedClinic}</h3>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">{selected.name}{mi(selected.id) ? ` · ${mi(selected.id)}` : ""}</p>
            <p className="text-sm text-slate-600" data-testid="closest-clinic-address">{selected.street}, {selected.suite}</p>
            <p className="text-sm text-slate-600">{selected.cityLine}</p>
            <a href={`/book?location=${selected.id}`} data-testid="book-at-clinic" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700">
              {L.bookHere}
            </a>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="mx-auto mb-4 w-fit"><Emblem d={PHONE} /></div>
            <h3 className="font-bold text-brand-900 mb-1">{L.phone}</h3>
            <Phones c={selected} />
            <p className="text-xs text-slate-500 mt-1">Se habla español</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="mx-auto mb-4 w-fit"><Emblem d={CLOCK} /></div>
            <h3 className="font-bold text-brand-900 mb-1">{L.hours}</h3>
            <p className="text-sm text-slate-600">{L.hoursWeek}</p>
            <p className="text-sm text-slate-600">{L.hoursSat}</p>
            <p className="text-sm text-slate-500">{L.hoursSun}</p>
          </div>
        </div>
      ) : (
        <div data-testid="all-clinics-cards">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="font-bold text-brand-900">{geo.state === "detecting" ? L.findingClinic : L.ourClinics}</span>
            {geo.state === "denied" && (
              <button type="button" onClick={locate} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                {L.useMyLocation}
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CLINIC_LOCATIONS.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(c.id); }}
                data-testid={`clinic-card-${c.id}`}
                className={`rounded-2xl border bg-white p-5 text-center transition-all hover:shadow-lg ${selectedId === c.id ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200"}`}
              >
                <div className="mx-auto mb-3 w-fit"><Emblem d={PIN} d2={PIN2} /></div>
                <h3 className="font-bold text-brand-900 mb-1 text-sm">{c.name}</h3>
                <p className="text-sm text-slate-600">{c.street}, {c.suite}</p>
                <p className="text-sm text-slate-600 mb-2">{c.cityLine}</p>
                <Phones c={c} />
                <a href={`/book?location=${c.id}`} onClick={(e) => e.stopPropagation()} data-testid={`book-at-${c.id}`} className="mt-3 inline-flex items-center rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                  {L.bookHere}
                </a>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <div className="mx-auto mb-3 w-fit"><Emblem d={CLOCK} /></div>
              <h3 className="font-bold text-brand-900 mb-1 text-sm">{L.hours}</h3>
              <p className="text-sm text-slate-600">{L.hoursWeek}</p>
              <p className="text-sm text-slate-600">{L.hoursSat}</p>
              <p className="text-sm text-slate-500">{L.hoursSun}</p>
              <p className="text-xs text-slate-500 mt-2">Se habla español</p>
            </div>
          </div>
        </div>
      )}

      {/* Destination picker — drives the Google map + 3D navigation */}
      <div className="mt-8 mb-3 flex flex-wrap items-center gap-2" data-testid="clinic-picker">
        <span className="text-sm font-semibold text-brand-900">{L.navigateTo}</span>
        {CLINIC_LOCATIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            data-testid={`clinic-pick-${c.id}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${selectedId === c.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
          >
            {c.name}
            <span className={`ml-1 font-normal ${selectedId === c.id ? "text-white/80" : "text-slate-400"}`}>{c.street}</span>
            {geo.state === "found" && geo.closestId === c.id ? " ★" : ""}
            {mi(c.id) ? ` · ${mi(c.id)}` : ""}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-6 items-stretch">
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-h-[300px]">
          <MapNav clinic={mapClinic} />
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-brand-100 bg-brand-50 p-6 flex flex-col justify-center">
          <h3 className="font-bold text-brand-900 mb-2">{L.insuranceTitle}</h3>
          <p className="text-sm text-slate-600">{L.insuranceDesc}</p>
          <BookingButton className="btn-primary mt-5 self-start">{L.scheduleVisit}</BookingButton>
        </div>
      </div>
    </>
  );
}
