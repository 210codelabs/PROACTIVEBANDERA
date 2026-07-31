"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "patient" | "staff";

export default function HeroLoginForm() {
  const [activeTab, setActiveTab] = useState<Tab>("patient");
  const router = useRouter();

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-r from-brand-200/30 to-indigo-200/30 rounded-3xl blur-2xl" />
      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("patient")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all ${
              activeTab === "patient"
                ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Patient Portal
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold transition-all ${
              activeTab === "staff"
                ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Staff Login
          </button>
        </div>

        <div className="p-6">
          {activeTab === "patient" ? <PatientForm router={router} /> : <StaffForm router={router} />}
        </div>
      </div>
    </div>
  );
}

function PatientForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [mrn, setMrn] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mrn, dob }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Unable to sign in");
        setSubmitting(false);
        return;
      }

      router.push("/portal/dashboard");
      router.refresh();
    } catch {
      setError("Portal is temporarily unavailable. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-brand-100">
        <div className="h-10 w-10 rounded-full bg-brand-100 grid place-items-center">
          <svg className="w-5 h-5 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <div className="font-semibold text-slate-900">Patient Access</div>
          <div className="text-xs text-slate-500">Secure portal for patients</div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label" htmlFor="hero-mrn">Medical Record Number (MRN)</label>
          <input
            id="hero-mrn"
            className="input border-brand-200 focus:border-brand-500 focus:ring-brand-500"
            value={mrn}
            onChange={(e) => setMrn(e.target.value)}
            placeholder="e.g. PC-100000"
            required
            suppressHydrationWarning
          />
        </div>
        <div>
          <label className="label" htmlFor="hero-dob">Date of Birth</label>
          <input
            id="hero-dob"
            className="input border-brand-200 focus:border-brand-500 focus:ring-brand-500"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
            suppressHydrationWarning
          />
        </div>
        {error && (
          <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>
        )}
        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-md hover:shadow-lg transition-all disabled:opacity-60"
          disabled={submitting}
          suppressHydrationWarning
        >
          {submitting ? "Signing in..." : "Access Patient Portal"}
        </button>
      </form>

      <div className="pt-3 border-t border-brand-100">
        <p className="text-xs text-slate-500 text-center">
          New patient? Your MRN is provided at your first visit.
        </p>
        <p className="text-xs text-slate-400 text-center mt-1">
          Demo: <code className="font-mono bg-slate-100 px-1 rounded">PC-100000</code> / DOB: 1958-04-12
        </p>
      </div>
    </div>
  );
}

function StaffForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [email, setEmail] = useState("mariuska.aristica@proactiveclinic.com");
  const [password, setPassword] = useState("apex123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) {
        setError(data?.error || "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-indigo-100">
        <div className="h-10 w-10 rounded-full bg-indigo-100 grid place-items-center">
          <svg className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <div className="font-semibold text-slate-900">Staff Access</div>
          <div className="text-xs text-slate-500">HIPAA-compliant EHR system</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label" htmlFor="hero-email">Email</label>
          <input
            id="hero-email"
            type="email"
            autoComplete="email"
            className="input border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            suppressHydrationWarning
          />
        </div>
        <div>
          <label className="label" htmlFor="hero-password">Password</label>
          <input
            id="hero-password"
            type="password"
            autoComplete="current-password"
            className="input border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            suppressHydrationWarning
          />
        </div>
        {error && (
          <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>
        )}
        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-60"
          disabled={loading}
          suppressHydrationWarning
        >
          {loading ? "Signing in..." : "Sign In to EHR"}
        </button>
      </form>

      <div className="pt-3 border-t border-indigo-100">
        <p className="text-xs text-slate-500 text-center">
          Demo: <code className="font-mono bg-slate-100 px-1 rounded">mariuska.aristica@proactiveclinic.com</code> / <code className="font-mono bg-slate-100 px-1 rounded">apex123</code>
        </p>
      </div>
    </div>
  );
}
