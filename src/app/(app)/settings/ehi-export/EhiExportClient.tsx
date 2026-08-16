"use client";

import { useMemo, useState } from "react";

type PatientRow = { id: string; mrn: string; name: string; dob: string };

export default function EhiExportClient({ patients, total }: { patients: PatientRow[]; total: number }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PatientRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 50);
    return patients
      .filter((p) => p.name.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q) || p.dob.includes(q))
      .slice(0, 50);
  }, [query, patients]);

  function download(url: string, key: string) {
    setBusy(key);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // give the browser a moment to start the download
      setTimeout(() => setBusy(null), 1500);
    }
  }

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <section className="card card-pad space-y-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-brand-100 text-brand-800 ring-brand-200">ONC Cures Act</span>
          <h2 className="font-semibold text-slate-900">Electronic Health Information (EHI) Export</h2>
        </div>
        <p className="text-sm text-slate-600">
          Export a patient&apos;s complete Electronic Health Information &mdash; or the entire
          practice&apos;s &mdash; in a computable, standards-based format required by the
          21st Century Cures Act (45 CFR 170.315(b)(10)).
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip bg-slate-100 text-slate-700 ring-slate-200">FHIR R4 (4.0.1)</span>
          <span className="chip bg-slate-100 text-slate-700 ring-slate-200">NDJSON (Bulk Data)</span>
          <span className="chip bg-slate-100 text-slate-700 ring-slate-200">One file per resource type</span>
          <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Includes manifest.json</span>
        </div>
        <p className="text-xs text-slate-500">
          Exports are logged to the audit trail. Handle the downloaded archive as PHI.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Single patient */}
        <section className="card card-pad space-y-3">
          <h3 className="font-semibold text-slate-900">Single patient</h3>
          <input
            className="input w-full"
            placeholder="Search by name, MRN or DOB…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-64 overflow-auto rounded-md ring-1 ring-slate-200 divide-y divide-slate-100">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-400">No matching patients.</div>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className={`w-full text-left px-3 py-2 text-sm transition hover:bg-brand-50 ${selected?.id === p.id ? "bg-brand-50 ring-1 ring-brand-200" : ""}`}
              >
                <div className="font-medium text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">MRN {p.mrn}{p.dob ? ` · DOB ${p.dob}` : ""}</div>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3 space-y-2">
              <div className="text-sm text-slate-700">
                Selected: <span className="font-semibold">{selected.name}</span> (MRN {selected.mrn})
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => download(`/api/admin/ehi-export?patientId=${encodeURIComponent(selected.id)}&format=zip`, "p-zip")}
                  className="btn-primary"
                >
                  {busy === "p-zip" ? "Preparing…" : "Download EHI (.zip)"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => download(`/api/admin/ehi-export?patientId=${encodeURIComponent(selected.id)}&format=ndjson`, "p-nd")}
                  className="btn-secondary"
                >
                  {busy === "p-nd" ? "Preparing…" : "Download .ndjson"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Select a patient to export their EHI.</p>
          )}
        </section>

        {/* Whole practice */}
        <section className="card card-pad space-y-3">
          <h3 className="font-semibold text-slate-900">Entire practice</h3>
          <p className="text-sm text-slate-600">
            Export EHI for all <span className="font-semibold">{total}</span> patient records in a single archive.
          </p>
          <div className="rounded-md bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-800">
            This can be a large file and includes PHI for every patient. Store and transmit securely.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || total === 0}
              onClick={() => download(`/api/admin/ehi-export?scope=all&format=zip`, "a-zip")}
              className="btn-primary"
            >
              {busy === "a-zip" ? "Preparing…" : "Download all EHI (.zip)"}
            </button>
            <button
              type="button"
              disabled={busy !== null || total === 0}
              onClick={() => download(`/api/admin/ehi-export?scope=all&format=ndjson`, "a-nd")}
              className="btn-secondary"
            >
              {busy === "a-nd" ? "Preparing…" : "Download all .ndjson"}
            </button>
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <h3 className="font-semibold text-slate-900 mb-2">What&apos;s included</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-slate-700">
          {[
            ["Patient", "Demographics"],
            ["Coverage", "Insurance"],
            ["Condition", "Problems / Dx"],
            ["AllergyIntolerance", "Allergies"],
            ["MedicationRequest", "Medications"],
            ["Observation", "Vital signs"],
            ["Immunization", "Immunizations"],
            ["Encounter", "Visits"],
            ["DocumentReference", "Notes & docs"],
            ["Practitioner", "Providers"],
          ].map(([t, d]) => (
            <div key={t} className="rounded-md bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
              <div className="font-mono text-xs text-brand-700">{t}</div>
              <div className="text-xs text-slate-500">{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
