// Helpers to read an uploaded file stored inside a Document body.
function parseJson(body: string | null): any {
  if (!body) return null;
  try { const o = JSON.parse(body); return o && typeof o === "object" ? o : null; } catch { return null; }
}

/** Extract the stored file (data URL) from a Document body, if any. */
export function extractDocumentFile(body: string | null): { mime: string; base64: string; fileName: string | null; note: string | null; uploadedByName: string | null } | null {
  if (!body) return null;
  const j = parseJson(body);
  const dataUrl: string = String(j?.fileDataUrl || j?.dataUrl || j?.file || (body.startsWith("data:") ? body : ""));
  const m = /^data:([\w.+/-]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2], fileName: j?.fileName || null, note: j?.note || null, uploadedByName: j?.uploadedByName || null };
}

/** Chart document categories offered on the Documents tab upload. */
export const DOC_CATEGORIES: { value: string; label: string }[] = [
  { value: "lab-report", label: "Lab report" },
  { value: "imaging", label: "Imaging / radiology" },
  { value: "referral", label: "Referral" },
  { value: "attorney-letter", label: "Attorney letter / legal" },
  { value: "insurance", label: "Insurance / EOB" },
  { value: "medical-records", label: "Outside medical records" },
  { value: "consent", label: "Consent / signed form" },
  { value: "id-card", label: "ID / insurance card" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export const ALLOWED_DOC_MIME = [
  "application/pdf",
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv",
];

/** Max upload size (raw bytes). Stored inline in MongoDB (16 MB doc cap). */
export const MAX_DOC_BYTES = 8 * 1024 * 1024;
