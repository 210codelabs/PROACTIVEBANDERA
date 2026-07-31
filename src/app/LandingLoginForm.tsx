"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LandingLoginForm() {
  const router = useRouter();
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="landing-mrn">Medical Record Number (MRN)</label>
        <input
          id="landing-mrn"
          className="input"
          value={mrn}
          onChange={(e) => setMrn(e.target.value)}
          placeholder="e.g. PC-100000"
          required
          suppressHydrationWarning
        />
      </div>
      <div>
        <label className="label" htmlFor="landing-dob">Date of Birth</label>
        <input
          id="landing-dob"
          className="input"
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
        className="btn-primary w-full"
        disabled={submitting}
        suppressHydrationWarning
      >
        {submitting ? "Signing in..." : "Sign In to Patient Portal"}
      </button>
      <p className="text-xs text-slate-500 text-center">
        Your MRN was provided at your first visit.{" "}
        <a href="tel:+13055550148" className="text-brand-700 hover:underline">
          Call us if you need help.
        </a>
      </p>
    </form>
  );
}
