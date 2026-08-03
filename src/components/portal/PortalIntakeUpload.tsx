"use client";

import React, { useState } from "react";

const BRAND = "#0E4770";

const FORM_OPTIONS = [
  { slug: "new-patient-intake", title: "New Patient Intake" },
  { slug: "current-patient-checkin", title: "Follow-Up Check-In" },
];

export default function PortalIntakeUpload() {
  const [slug, setSlug] = useState("new-patient-intake");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setOk(false);
    if (!file) return setMsg("Please choose a PDF or image of your completed form.");
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/portal/intake/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, fileName: file.name, dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Upload failed.");
      else {
        setOk(true);
        setFile(null);
        setMsg("Uploaded! Our team will review it. You can refresh to see it below.");
      }
    } catch {
      setMsg("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad mb-3">
      <h3 className="mb-1 font-semibold text-slate-800">Upload a completed intake form</h3>
      <p className="mb-3 text-sm text-slate-500">
        Filled out a printable form offline? Upload a PDF or photo and we'll attach it to your chart.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Form type</label>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {FORM_OPTIONS.map((f) => (
              <option key={f.slug} value={f.slug}>{f.title}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-600">File (PDF or image, ≤6MB)</label>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
        </div>
        <button onClick={upload} disabled={busy} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BRAND }}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {msg && <p className={`mt-2 text-sm ${ok ? "text-green-600" : "text-red-600"}`}>{msg}</p>}
    </section>
  );
}
