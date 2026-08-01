"use client";

import { useState } from "react";

type Branding = {
  appName: string;
  slogan: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
};

export default function BrandingManager({ initialBranding }: { initialBranding: Branding }) {
  const [branding, setBranding] = useState(initialBranding);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "branding", data: branding }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Could not save branding");
      setSaving(false);
      return;
    }
    setBranding(data.config.branding);
    setMessage("Branding settings saved.");
    setSaving(false);
  }

  return (
    <section className="card card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Brand Identity</h2>
        <button disabled={saving} onClick={save} className="btn-primary">{saving ? "Saving..." : "Save Branding"}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="input" placeholder="Application name" value={branding.appName} onChange={(e) => setBranding((v) => ({ ...v, appName: e.target.value }))} />
        <input className="input" placeholder="Slogan" value={branding.slogan} onChange={(e) => setBranding((v) => ({ ...v, slogan: e.target.value }))} />
        <input className="input" placeholder="Logo URL" value={branding.logoUrl} onChange={(e) => setBranding((v) => ({ ...v, logoUrl: e.target.value }))} />
        <input className="input" placeholder="Support email" value={branding.supportEmail} onChange={(e) => setBranding((v) => ({ ...v, supportEmail: e.target.value }))} />
        <input className="input" placeholder="Support phone" value={branding.supportPhone} onChange={(e) => setBranding((v) => ({ ...v, supportPhone: e.target.value }))} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs font-semibold text-slate-600">Primary
          <input type="color" className="input h-10 p-1" value={branding.primaryColor} onChange={(e) => setBranding((v) => ({ ...v, primaryColor: e.target.value }))} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Secondary
          <input type="color" className="input h-10 p-1" value={branding.secondaryColor} onChange={(e) => setBranding((v) => ({ ...v, secondaryColor: e.target.value }))} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Accent
          <input type="color" className="input h-10 p-1" value={branding.accentColor} onChange={(e) => setBranding((v) => ({ ...v, accentColor: e.target.value }))} />
        </label>
      </div>

      <div className="rounded-md p-4 ring-1 ring-slate-200" style={{ background: `linear-gradient(120deg, ${branding.secondaryColor}, ${branding.primaryColor})` }}>
        <div className="text-white text-xl font-bold">{branding.appName}</div>
        <div className="text-teal-50 text-sm">{branding.slogan}</div>
      </div>

      {message && <p className="text-xs text-slate-600">{message}</p>}
    </section>
  );
}
