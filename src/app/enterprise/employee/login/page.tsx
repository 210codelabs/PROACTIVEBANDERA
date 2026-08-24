"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EmployeeLogin() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/enterprise/employee-portal/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode, pin }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Login failed"); return; }
      router.push("/enterprise/employee");
    } catch { setErr("Login failed"); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="text-slate-500 text-sm hover:text-slate-800">← ProactiveClinics</Link>
          <img src="/enterprise-logo.png?v=3" alt="ProactiveClinic Enterprise" className="mt-4 w-full max-w-md mx-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)]" />
          <p className="text-slate-500 text-sm mt-2">Employee access — view your results & sign forms</p>
        </div>
        <form onSubmit={submit} className="relative bg-slate-900 rounded-2xl shadow-2xl p-6 space-y-4 ring-1 ring-white/10 border-t-4 border-blue-600">
          <div className="text-center pb-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Employee Portal</p>
            <p className="text-[11px] text-slate-400 mt-1">Use the access code and PIN provided by your employer</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Access code</label>
            <input className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="EMP-XXXXXX" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">PIN</label>
            <input type="password" inputMode="numeric" className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={pin} onChange={(e) => setPin(e.target.value)} required />
          </div>
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 transition-colors disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-[11px] text-slate-400"><Link href="/enterprise/login" className="underline hover:text-slate-200">Company / clinic admin sign-in</Link></p>
        </form>
      </div>
    </div>
  );
}
