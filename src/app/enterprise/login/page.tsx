"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EnterpriseLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/enterprise/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Login failed"); return; }
      router.push("/enterprise");
    } catch { setErr("Login failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="text-white/70 text-sm hover:text-white">← ProactiveClinics</Link>
          <h1 className="mt-3 text-2xl font-bold text-white">Enterprise Portal</h1>
          <p className="text-white/60 text-sm">Corporate & occupational health client access</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div>
            <label className="label">Work email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-[11px] text-slate-400 text-center">Access is provisioned by the clinic. Contact your account manager for credentials.</p>
        </form>
      </div>
    </div>
  );
}
