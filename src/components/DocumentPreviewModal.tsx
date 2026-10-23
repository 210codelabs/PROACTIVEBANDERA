"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type PreviewDoc = { id: string; title: string; mime: string; fileName: string | null };

// Popup preview for an uploaded chart document. PDFs use the browser's native
// PDF viewer (iframe); images render inline. Red download button (white text).
export default function DocumentPreviewModal({ patientId, doc, onClose }: { patientId: string; doc: PreviewDoc | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [doc, onClose]);

  if (!doc || !mounted) return null;
  const src = `/api/patients/${patientId}/documents/${doc.id}/file`;
  const isPdf = doc.mime === "application/pdf";
  const isImage = doc.mime.startsWith("image/");
  const isText = doc.mime === "text/plain" || doc.mime === "text/csv";

  // Portal to <body> so the popup sits above the sticky header / side widgets.
  return createPortal(
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose} data-testid="doc-preview-modal" role="dialog" aria-modal="true">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{doc.title}</div>
            {doc.fileName && <div className="truncate text-xs text-slate-500">{doc.fileName}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`${src}?download=1`}
              data-testid="doc-download-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" /></svg>
              Download
            </a>
            <button onClick={onClose} data-testid="doc-preview-close" className="rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100">
          {isPdf ? (
            <iframe title={doc.title} src={src} className="h-full w-full border-0" data-testid="doc-preview-pdf" />
          ) : isImage ? (
            <div className="flex min-h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={doc.title} className="max-h-[80vh] max-w-full rounded shadow" data-testid="doc-preview-img" />
            </div>
          ) : isText ? (
            <iframe title={doc.title} src={src} className="h-full w-full border-0 bg-white" data-testid="doc-preview-text" />
          ) : (
            <div className="p-6 text-sm text-slate-600">Preview isn&apos;t available for this file type. Use Download to open it.</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
