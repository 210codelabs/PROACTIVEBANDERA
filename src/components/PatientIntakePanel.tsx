"use client";

import React, { useState } from "react";

const BRAND = "#0E4770";
const ACCENT = "#0A8C8C";

const BLANK_FORMS = [
  { slug: "clinical-new-patient", title: "Clinical — New Patient Intake" },
  { slug: "clinical-checkin", title: "Clinical — Follow-Up Check-In" },
  { slug: "new-patient-intake", title: "Personal Injury — New Patient Intake" },
  { slug: "current-patient-checkin", title: "Personal Injury — Follow-Up Check-In" },
  { slug: "first-office-visit", title: "First Office Visit" },
  { slug: "followup-visit", title: "Follow-Up Visit" },
  { slug: "procedure-report", title: "Procedure Report" },
];

export type IntakeDoc = { id: string; title: string; kind: "online" | "upload"; createdAt: string };

export default function PatientIntakePanel({
  patientId,
  intakeDocs,
}: {
  patientId: string;
  intakeDocs: IntakeDoc[];
}) {
  const [lang, setLang] = useState<"en" | "es">("en");
  const [showBlank, setShowBlank] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadSlug, setUploadSlug] = useState("new-patient-intake");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  function open(url: string) {
    window.open(url, "_blank");
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function upload() {
    setMsg(""); setOk(false);
    if (!file) return setMsg("Choose a PDF or image to upload.");
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/intake/submissions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, slug: uploadSlug, fileName: file.name, dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Upload failed.");
      else { setOk(true); setMsg("Uploaded and attached to this chart."); setFile(null); }
    } catch { setMsg("Upload failed."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card mb-3">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="font-semibold text-slate-800">Intake Forms — Issue, Download &amp; Upload</span>
        <button
          onClick={() => setLang(lang === "en" ? "es" : "en")}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          🌐 {lang === "en" ? "Español" : "English"}
        </button>
      </header>

      <div className="p-4">
        {/* Issuance actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <IssueCard
            title="New — Clinical"
            desc="Blank Clinical New Patient Intake (general therapy)."
            actionLabel="Open / Print"
            onClick={() => open(`/api/intake/forms/clinical-new-patient/pdf?lang=${lang}`)}
          />
          <IssueCard
            title="New — Personal Injury"
            desc="Blank PI New Patient Intake (auto accident / PIP)."
            actionLabel="Open / Print"
            onClick={() => open(`/api/intake/forms/new-patient-intake/pdf?lang=${lang}`)}
          />
          <IssueCard
            title="Renew"
            desc="Follow-Up Check-In (Clinical or PI)."
            actionLabel="Clinical"
            onClick={() => open(`/api/intake/forms/clinical-checkin/pdf?lang=${lang}`)}
            secondLabel="Personal Injury"
            onSecond={() => open(`/api/intake/forms/current-patient-checkin/pdf?lang=${lang}`)}
          />
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-bold" style={{ color: BRAND }}>Duplicate</div>
            <p className="mt-1 text-xs text-slate-500">Re-issue a copy of a form already on this chart.</p>
            {intakeDocs.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">No intake forms on file yet.</p>
            ) : (
              <div className="mt-3 max-h-32 space-y-1 overflow-auto">
                {intakeDocs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() =>
                      open(d.kind === "online" ? `/api/intake/submissions/${d.id}/pdf` : `/api/intake/submissions/${d.id}/file`)
                    }
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-700">{d.title}</span>
                    <span className="ml-2 shrink-0 text-teal-600">↓</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Blank downloads */}
        <button onClick={() => setShowBlank((s) => !s)} className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-700">
          {showBlank ? "Hide" : "Show"} all blank printable forms ▾
        </button>
        {showBlank && (
          <div className="mt-2 flex flex-wrap gap-2">
            {BLANK_FORMS.map((f) => (
              <a
                key={f.slug}
                href={`/api/intake/forms/${f.slug}/pdf?lang=${lang}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {f.title} (PDF)
              </a>
            ))}
          </div>
        )}

        {/* Upload */}
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">Upload a completed offline form</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Form type</label>
              <select value={uploadSlug} onChange={(e) => setUploadSlug(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {BLANK_FORMS.map((f) => (
                  <option key={f.slug} value={f.slug}>{f.title}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600">File (PDF or image, ≤6MB)</label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
            <button onClick={upload} disabled={busy} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {busy ? "Uploading…" : "Upload"}
            </button>
          </div>
          {msg && <p className={`mt-2 text-sm ${ok ? "text-green-600" : "text-red-600"}`}>{msg}</p>}
        </div>
      </div>
    </section>
  );
}

function IssueCard({ title, desc, actionLabel, onClick, secondLabel, onSecond }: { title: string; desc: string; actionLabel: string; onClick: () => void; secondLabel?: string; onSecond?: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-sm font-bold" style={{ color: BRAND }}>{title}</div>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onClick} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: BRAND }}>
          {actionLabel}
        </button>
        {secondLabel && onSecond && (
          <button onClick={onSecond} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {secondLabel}
          </button>
        )}
      </div>
    </div>
  );
}
