"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PortalLoginForm() {
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
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Medical Record Number (MRN)</label>
        <input className="input" value={mrn} onChange={(e) => setMrn(e.target.value)} placeholder="Example: AC100042" required suppressHydrationWarning />
      </div>
      <div>
        <label className="label">Date of Birth</label>
        <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required suppressHydrationWarning />
      </div>
      <button className="btn-primary w-full" disabled={submitting} suppressHydrationWarning>{submitting ? "Signing in..." : "Access Patient Portal"}</button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
