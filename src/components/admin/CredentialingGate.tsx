"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AccessCtx = { verify: () => Promise<boolean> };
const Ctx = createContext<AccessCtx>({ verify: async () => false });
export function useCredentialingAccess() { return useContext(Ctx); }

/**
 * Gates the Credentialing section behind an "Administrative Access" password.
 * - On entry a floating password window is shown; the correct password reveals
 *   the section (remembered for the browser session).
 * - A wrong password renders a blank page with the required-access disclaimer.
 * - verify() (from context) re-prompts for the password before saving values.
 * Password is verified server-side via /api/admin/credentialing/access.
 */
export default function CredentialingGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [denied, setDenied] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"gate" | "reauth">("gate");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  useEffect(() => {
    setMounted(true);
    let ok = false;
    try { ok = sessionStorage.getItem("cred_unlocked") === "1"; } catch { /* ignore */ }
    if (ok) setUnlocked(true);
    else { setMode("gate"); setShowModal(true); }
    setChecked(true);
  }, []);

  async function check(password: string): Promise<boolean> {
    const r = await fetch("/api/admin/credentialing/access", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    });
    const d = await r.json().catch(() => ({}));
    return Boolean(r.ok && d.ok);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      const good = await check(pw);
      if (good) {
        setPw("");
        setShowModal(false);
        if (mode === "gate") { try { sessionStorage.setItem("cred_unlocked", "1"); } catch { /* ignore */ } setUnlocked(true); }
        if (resolverRef.current) { resolverRef.current(true); resolverRef.current = null; }
      } else if (mode === "gate") {
        setShowModal(false);
        setDenied(true);
      } else {
        setErr("Incorrect password. Try again.");
        setPw("");
      }
    } catch {
      setErr("Access check is unavailable.");
    } finally { setBusy(false); }
  }

  function cancelReauth() {
    setShowModal(false); setPw(""); setErr("");
    if (resolverRef.current) { resolverRef.current(false); resolverRef.current = null; }
  }

  const verify = useCallback(() => new Promise<boolean>((resolve) => {
    resolverRef.current = resolve;
    setMode("reauth"); setPw(""); setErr(""); setShowModal(true);
  }), []);

  if (!checked) return null;

  if (denied) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-full bg-slate-100 text-slate-400">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 118 0v3" /></svg>
          </div>
          <p className="text-slate-500">Administrative Access Level is required for access this section</p>
          <button onClick={() => { setDenied(false); setMode("gate"); setShowModal(true); }} className="mt-4 text-sm text-brand-700 hover:underline">Enter password</button>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ verify }}>
      {unlocked ? children : <div className="min-h-[40vh]" />}

      {mounted && showModal && createPortal((
        <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-[400px] max-w-[94vw] rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 118 0v3" /></svg>
                <span className="text-sm font-extrabold">Administrative Access</span>
              </div>
              <p className="text-[11px] text-white/70 mt-0.5">{mode === "reauth" ? "Re-enter the administrative password to save changes." : "Enter the administrative password to open Credentialing."}</p>
            </div>
            <div className="p-4 space-y-3">
              {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
              <label className="block">
                <span className="label">Password</span>
                <input autoFocus type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
              </label>
            </div>
            <footer className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              {mode === "reauth" && <button type="button" onClick={cancelReauth} className="btn-secondary">Cancel</button>}
              <button type="submit" disabled={busy || !pw} className="btn-primary">{busy ? "Checking…" : "Unlock"}</button>
            </footer>
          </form>
        </div>
      ), document.body)}
    </Ctx.Provider>
  );
}
