"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DOC_CATEGORIES, ALLOWED_DOC_MIME, MAX_DOC_BYTES } from "@/lib/documentFile";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.txt,.csv";

function readAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(f);
  });
}

// Some browsers report "" for .docx/.csv; infer from the extension.
function mimeFor(f: File): string {
  if (f.type) return f.type.toLowerCase();
  const ext = f.name.split(".").pop()?.toLowerCase();
  return ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", csv: "text/csv" } as Record<string, string>)[ext || ""] || "";
}

export default function ChartDocumentUpload({ patientId }: { patientId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("lab-report");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    const bad = arr.find((f) => !ALLOWED_DOC_MIME.includes(mimeFor(f)));
    const big = arr.find((f) => f.size > MAX_DOC_BYTES);
    if (bad) return setMsg({ ok: false, text: `"${bad.name}" is not a supported type (PDF, image, Word, text, CSV).` });
    if (big) return setMsg({ ok: false, text: `"${big.name}" is larger than ${MAX_DOC_BYTES / 1024 / 1024} MB.` });
    setMsg(null);
    setFiles(arr.slice(0, 10));
  }

  function send(body: any, onPct: (p: number) => void): Promise<any> {
    // XHR so we can show real upload progress.
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("POST", `/api/patients/${patientId}/documents`);
      x.setRequestHeader("Content-Type", "application/json");
      x.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
      x.onload = () => {
        let d: any = {};
        try { d = JSON.parse(x.responseText || "{}"); } catch { /* ignore */ }
        if (x.status >= 200 && x.status < 300) resolve(d);
        else reject(new Error(d.error || (x.status === 413 ? "File is too large." : `Upload failed (${x.status}).`)));
      };
      x.onerror = () => reject(new Error("Network error during upload."));
      x.send(JSON.stringify(body));
    });
  }

  async function upload() {
    if (!files.length) return setMsg({ ok: false, text: "Choose at least one file." });
    setBusy(true); setMsg(null);
    let ok = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress({ done: i, total: files.length, pct: 0 });
        const raw = await readAsDataUrl(f);
        const mime = mimeFor(f);
        // Normalise data URL mime (some browsers emit application/octet-stream).
        const dataUrl = raw.replace(/^data:[^;]*;base64,/, `data:${mime};base64,`);
        await send(
          { category, fileName: f.name, dataUrl, note, title: files.length === 1 ? title : (title ? `${title} (${i + 1})` : "") },
          (pct) => setProgress({ done: i, total: files.length, pct }),
        );
        ok++;
      }
      setMsg({ ok: true, text: `Uploaded ${ok} document${ok === 1 ? "" : "s"} to the chart.` });
      setFiles([]); setTitle(""); setNote("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e: any) {
      setMsg({ ok: false, text: `${ok ? `Uploaded ${ok}, then: ` : ""}${e?.message || "Upload failed."}` });
      if (ok) router.refresh();
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  return (
    <section className="card card-pad mb-4 space-y-3" data-testid="chart-doc-upload">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Upload document</h3>
        <span className="text-[11px] text-slate-500">PDF, images, Word, text, CSV · up to {MAX_DOC_BYTES / 1024 / 1024} MB each · max 10 at once</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="label">Category</span>
          <select data-testid="doc-upload-category" className="input w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Title (optional)</span>
          <input data-testid="doc-upload-title" className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. MRI lumbar spine 10/2026" />
        </label>
        <label className="text-sm">
          <span className="label">Note (optional)</span>
          <input data-testid="doc-upload-note" className="input w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Received from Smith & Co. law firm" />
        </label>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}`}
      >
        <input ref={inputRef} data-testid="doc-upload-input" type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
        {files.length ? (
          <div className="space-y-0.5 text-slate-700">
            {files.map((f) => <div key={f.name + f.size} className="truncate">{f.name} <span className="text-slate-400">· {(f.size / 1024).toFixed(0)} KB</span></div>)}
          </div>
        ) : (
          <span className="text-slate-500">Drag & drop files here, or <span className="font-semibold text-brand-700">browse</span></span>
        )}
      </div>
      {progress && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200"><div className="h-2 bg-brand-600 transition-all" style={{ width: `${progress.pct}%` }} /></div>
          <div className="text-[11px] text-slate-500">Uploading file {progress.done + 1} of {progress.total} · {progress.pct}%</div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className={`text-sm ${msg ? (msg.ok ? "text-emerald-700" : "text-rose-700") : ""}`} data-testid="doc-upload-msg">{msg?.text}</div>
        <button data-testid="doc-upload-submit" onClick={upload} disabled={busy || !files.length} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? "Uploading…" : `Upload${files.length > 1 ? ` ${files.length} files` : ""}`}
        </button>
      </div>
    </section>
  );
}
