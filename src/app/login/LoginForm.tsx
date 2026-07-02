"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("mariuska.aristica@proactivemedical.com");
  const [password, setPassword] = useState("apex123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(next || "/dashboard");
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          suppressHydrationWarning
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          suppressHydrationWarning
        />
      </div>
      {error && (
        <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>
      )}
      <button className="btn-primary w-full" disabled={loading} type="submit" suppressHydrationWarning>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
