// Helpers to read an uploaded file stored inside a Document body.
function parseJson(body: string | null): any {
  if (!body) return null;
  try { const o = JSON.parse(body); return o && typeof o === "object" ? o : null; } catch { return null; }
}

/** Extract the stored file (data URL) from a Document body, if any. */
export function extractDocumentFile(body: string | null): { mime: string; base64: string; fileName: string | null } | null {
  if (!body) return null;
  const j = parseJson(body);
  const dataUrl: string = String(j?.fileDataUrl || j?.dataUrl || j?.file || (body.startsWith("data:") ? body : ""));
  const m = /^data:([\w.+/-]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2], fileName: j?.fileName || null };
}
