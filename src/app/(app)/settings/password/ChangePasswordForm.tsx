"use client";

import React, { useState } from "react";

export default function ChangePasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ tone: "err", text: "New password and confirmation do not match." }); return; }
    if (next.length < 8) { setMsg({ tone: "err", text: "New password must be at least 8 characters." }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ tone: "err", text: d.error || "Could not change password." }); return; }
      setMsg({ tone: "ok", text: "Password updated successfully." });
      setCur(""); setNext(""); setConfirm("");
    } catch {
      setMsg({ tone: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Current password</span>
        <input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-slate-600">New password</span>
        <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        <span className="mt-1 block text-[11px] text-slate-400">At least 8 characters.</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Confirm new password</span>
        <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </label>
      {msg && (
        <div className={`rounded-md px-3 py-2 text-sm ring-1 ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{msg.text}</div>
      )}
      <button type="submit" disabled={busy} className="btn-primary">{busy ? "Updating…" : "Update password"}</button>
    </form>
  );
}
