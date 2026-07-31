"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        setError(data?.error || t("login.loginFailed"));
        return;
      }
      router.push(next || "/dashboard");
      router.refresh();
    } catch {
      setError(t("login.retry"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div>
        <label className="label" htmlFor="email">{t("common.email")}</label>
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
        <label className="label" htmlFor="password">{t("common.password")}</label>
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
        {loading ? t("common.signingIn") : t("common.signIn")}
      </button>
    </form>
  );
}
