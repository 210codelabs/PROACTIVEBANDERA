"use client";

import React, { useEffect, useState } from "react";

const BRAND = "#0E4770";
const ACCENT = "#0A8C8C";

type Sub = {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  title: string;
  category: string;
  kind: "online" | "upload";
  formSlug: string;
  formTitle: string;
  confirmation: string;
  lang: string;
  fileName: string;
  reviewStatus: string;
  reviewedByName: string;
  reviewedAt: string;
  submittedAt: string;
};

const FORM_OPTIONS = [
  { slug: "new-patient-intake", title: "New Patient Intake" },
  { slug: "current-patient-checkin", title: "Follow-Up Check-In" },
  { slug: "first-office-visit", title: "First Office Visit" },
  { slug: "followup-visit", title: "Follow-Up Visit" },
  { slug: "procedure-report", title: "Procedure Report" },
];

export default function IntakeInboxPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "all">("pending");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
  const [flash, setFlash] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/intake/submissions?status=${tab}`);
      const data = await res.json();
      setSubs(data.submissions || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function review(id: string, action: "approve" | "reopen") {
    setBusy(id);
    try {
      const res = await fetch(`/api/intake/submissions/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (action === "approve" && data.attached) {
        const a = data.attached;
        const total = (a.problems || 0) + (a.allergies || 0) + (a.medications || 0);
        setFlash(
          total > 0
            ? `Approved. Added to chart: ${a.problems} problem(s), ${a.allergies} allergy(ies), ${a.medications} medication(s).`
            : "Approved. No new chart items to add."
        );
        setTimeout(() => setFlash(""), 6000);
      }
      await load();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Intake Review Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify and approve online intake submissions and uploaded offline forms.
          </p>
        </div>
        <button
          onClick={() => setShowUpload((s) => !s)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: ACCENT }}
        >
          {showUpload ? "Close upload" : "Upload offline form"}
        </button>
      </div>

      {showUpload && <UploadPanel onDone={() => { setShowUpload(false); setTab("pending"); load(); }} />}

      {flash && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{flash}</div>
      )}

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {(["pending", "approved", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
            style={tab === t ? { background: BRAND } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : subs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No {tab === "all" ? "" : tab} submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{s.patientName}</span>
                    <span className="text-xs text-slate-400">MRN {s.mrn || "—"}</span>
                    <Badge status={s.reviewStatus} />
                    {s.kind === "upload" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">Uploaded</span>
                    ) : (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-teal-600">
                        Online{s.lang === "es" ? " · ES" : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{s.formTitle}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {s.confirmation ? `Conf ${s.confirmation} · ` : ""}
                    {new Date(s.submittedAt).toLocaleString()}
                    {s.reviewedByName ? ` · approved by ${s.reviewedByName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.kind === "online" ? (
                    <a
                      href={`/api/intake/submissions/${s.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Completed PDF
                    </a>
                  ) : (
                    <a
                      href={`/api/intake/submissions/${s.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      View file
                    </a>
                  )}
                  <a
                    href={`/patients/${s.patientId}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Open chart
                  </a>
                  {s.reviewStatus === "approved" ? (
                    <button
                      onClick={() => review(s.id, "reopen")}
                      disabled={busy === s.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => review(s.id, "approve")}
                      disabled={busy === s.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: BRAND }}
                    >
                      {busy === s.id ? "…" : "Approve"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const approved = status === "approved";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
        approved ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"
      }`}
    >
      {approved ? "Approved" : "Pending"}
    </span>
  );
}

function UploadPanel({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [slug, setSlug] = useState("new-patient-intake");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!q.trim()) return;
    const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=8`);
    const data = await res.json();
    setResults(data.results || []);
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  }

  async function upload() {
    setMsg("");
    if (!patient) return setMsg("Select a patient first.");
    if (!file) return setMsg("Choose a PDF or image file.");
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/intake/submissions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, slug, fileName: file.name, dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Upload failed.");
      else onDone();
    } catch {
      setMsg("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-800">Upload a completed offline form</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Find patient (name or MRN)</label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. PC-100000 or Adams"
            />
            <button onClick={search} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
              Search
            </button>
          </div>
          {results.length > 0 && !patient && (
            <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-100">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setPatient(r); setResults([]); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>{r.firstName} {r.lastName}</span>
                  <span className="text-xs text-slate-400">{r.mrn}</span>
                </button>
              ))}
            </div>
          )}
          {patient && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>{patient.firstName} {patient.lastName} · {patient.mrn}</span>
              <button onClick={() => setPatient(null)} className="text-xs text-slate-400 hover:text-slate-600">Change</button>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Form type</label>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {FORM_OPTIONS.map((f) => (
              <option key={f.slug} value={f.slug}>{f.title}</option>
            ))}
          </select>
          <label className="mb-1 mt-3 block text-xs font-semibold text-slate-600">File (PDF or image, ≤6MB)</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
        </div>
      </div>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <div className="mt-4 flex justify-end">
        <button onClick={upload} disabled={busy} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BRAND }}>
          {busy ? "Uploading…" : "Upload & attach"}
        </button>
      </div>
    </div>
  );
}
