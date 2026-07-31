"use client";

import { useState } from "react";

type Landing = {
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  featureCards: Array<{ title: string; description: string }>;
};

export default function LandingManager({ initialLanding }: { initialLanding: Landing }) {
  const [landing, setLanding] = useState(initialLanding);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "landing", data: landing }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Could not save landing settings");
      setSaving(false);
      return;
    }
    setLanding(data.config.landing);
    setMessage("Landing page settings saved.");
    setSaving(false);
  }

  function setFeature(index: number, key: "title" | "description", value: string) {
    setLanding((prev) => ({
      ...prev,
      featureCards: prev.featureCards.map((feature, i) => (i === index ? { ...feature, [key]: value } : feature)),
    }));
  }

  return (
    <section className="card card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Landing Page Content</h2>
        <button disabled={saving} onClick={save} className="btn-primary">{saving ? "Saving..." : "Save Landing"}</button>
      </div>

      <input className="input" placeholder="Hero title" value={landing.heroTitle} onChange={(e) => setLanding((v) => ({ ...v, heroTitle: e.target.value }))} />
      <textarea className="input min-h-20" placeholder="Hero subtitle" value={landing.heroSubtitle} onChange={(e) => setLanding((v) => ({ ...v, heroSubtitle: e.target.value }))} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="input" placeholder="Primary CTA label" value={landing.ctaPrimaryLabel} onChange={(e) => setLanding((v) => ({ ...v, ctaPrimaryLabel: e.target.value }))} />
        <input className="input" placeholder="Primary CTA href" value={landing.ctaPrimaryHref} onChange={(e) => setLanding((v) => ({ ...v, ctaPrimaryHref: e.target.value }))} />
        <input className="input" placeholder="Secondary CTA label" value={landing.ctaSecondaryLabel} onChange={(e) => setLanding((v) => ({ ...v, ctaSecondaryLabel: e.target.value }))} />
        <input className="input" placeholder="Secondary CTA href" value={landing.ctaSecondaryHref} onChange={(e) => setLanding((v) => ({ ...v, ctaSecondaryHref: e.target.value }))} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Feature Cards</div>
        {landing.featureCards.map((feature, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md ring-1 ring-slate-200 p-3">
            <input className="input" value={feature.title} onChange={(e) => setFeature(idx, "title", e.target.value)} placeholder={`Feature ${idx + 1} title`} />
            <input className="input" value={feature.description} onChange={(e) => setFeature(idx, "description", e.target.value)} placeholder={`Feature ${idx + 1} description`} />
          </div>
        ))}
      </div>

      {message && <p className="text-xs text-slate-600">{message}</p>}
    </section>
  );
}
