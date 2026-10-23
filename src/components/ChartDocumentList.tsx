"use client";

import React, { useState } from "react";
import DocumentPreviewModal, { PreviewDoc } from "@/components/DocumentPreviewModal";

export type ChartDoc = {
  id: string;
  title: string;
  category: string | null;
  createdLabel: string;
  file: { mime: string; fileName: string | null } | null;
  meta: Record<string, any> | null; // signed consent / intake metadata
  text: string | null;
};

export default function ChartDocumentList({ patientId, docs }: { patientId: string; docs: ChartDoc[] }) {
  const [open, setOpen] = useState<PreviewDoc | null>(null);

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {docs.map((d) => {
          const meta = d.meta;
          const clickable = Boolean(d.file);
          const openIt = () => d.file && setOpen({ id: d.id, title: d.title, mime: d.file.mime, fileName: d.file.fileName });
          return (
            <li key={d.id} className="px-4 py-3" data-testid={`chart-doc-${d.id}`}>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={openIt}
                  disabled={!clickable}
                  className={`flex min-w-0 items-center gap-3 text-left ${clickable ? "cursor-pointer group" : "cursor-default"}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${d.file?.mime === "application/pdf" ? "bg-red-50 text-red-600" : d.file ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-600"}`}>
                    {d.file && d.file.mime.startsWith("image/") ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zm8-12h.01" /></svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h6l6 6v10a2 2 0 01-2 2z" /></svg>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className={`truncate font-medium ${clickable ? "text-brand-700 group-hover:underline" : "text-slate-800"}`}>{d.title}</div>
                    <div className="text-xs text-slate-500">
                      {d.createdLabel}
                      {d.file && <> · {d.file.mime === "application/pdf" ? "PDF" : "Image"}{d.file.fileName ? ` · ${d.file.fileName}` : ""}</>}
                    </div>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {d.file && (
                    <>
                      <button type="button" onClick={openIt} className="chip bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 text-xs" data-testid={`doc-view-${d.id}`}>View</button>
                      <a href={`/api/patients/${patientId}/documents/${d.id}/file?download=1`} className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700">Download</a>
                    </>
                  )}
                  <span className="chip bg-slate-100 text-slate-600 ring-slate-200 capitalize">{d.category || "other"}</span>
                </div>
              </div>
              {meta ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:text-brand-900">View signed intake</summary>
                  <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200 sm:grid-cols-2">
                    {meta.confirmation && <div><span className="text-slate-400">Confirmation:</span> <span className="font-mono">{meta.confirmation}</span></div>}
                    {meta.module && <div><span className="text-slate-400">Module:</span> {meta.module}</div>}
                    {meta.reason && <div><span className="text-slate-400">Reason:</span> {meta.reason}</div>}
                    {meta.phone && <div><span className="text-slate-400">Phone:</span> {meta.phone}</div>}
                    {meta.email && <div><span className="text-slate-400">Email:</span> {meta.email}</div>}
                    <div><span className="text-slate-400">HIPAA consent:</span> {meta.hipaaConsent ? "Acknowledged" : "No"}</div>
                    {meta.signature && <div className="sm:col-span-2"><span className="text-slate-400">Signature:</span> <span className="font-[cursive] text-base">{meta.signature}</span></div>}
                    {meta.submittedAt && <div className="text-xs text-slate-400 sm:col-span-2">Submitted {new Date(meta.submittedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} · source: {meta.source || "kiosk"}</div>}
                  </div>
                </details>
              ) : d.text ? (
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{d.text}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <DocumentPreviewModal patientId={patientId} doc={open} onClose={() => setOpen(null)} />
    </>
  );
}
