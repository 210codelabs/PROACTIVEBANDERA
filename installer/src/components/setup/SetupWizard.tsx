"use client";

import { useMemo, useState } from "react";
import { buildThemeCss } from "@/lib/site/theme";
import type { SiteConfig } from "@/lib/site/config";

const STEPS = ["Identity", "Branding", "Modules", "Review"] as const;

const MODULE_META: { key: keyof SiteConfig["modules"]; label: string; desc: string }[] = [
  { key: "ehr", label: "Clinical EHR", desc: "Patients, encounters, orders, vitals, billing." },
  { key: "portal", label: "Patient Portal", desc: "Appointments, messages and AI assistant for patients." },
  { key: "kiosk", label: "Lobby Kiosk", desc: "Self check-in, HIPAA consent and promo slideshow." },
  { key: "legal", label: "Legal / Rehabilitation Cases", desc: "Attorney cases, liens, offers and deliverables." },
  { key: "attorneyPortal", label: "Attorney Portal", desc: "Record requests and gated downloads for law firms." },
  { key: "pharmacyPos", label: "Pharmacy & Point of Sale", desc: "Dispensary, inventory and retail checkout." },
  { key: "aiAssistant", label: "AI Clinical Assistant", desc: "SOAP generation, chart Q&A and dictation." },
];

export default function SetupWizard({ initial }: { initial: SiteConfig }) {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<SiteConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Live re-theme the wizard itself as colors change.
  const themeCss = useMemo(() => buildThemeCss(cfg.colors), [cfg.colors]);

  function setIdentity<K extends keyof SiteConfig["identity"]>(k: K, v: string) {
    setCfg((c) => ({ ...c, identity: { ...c.identity, [k]: v } }));
  }
  function setColor(k: keyof SiteConfig["colors"], v: string) {
    setCfg((c) => ({ ...c, colors: { ...c.colors, [k]: v } }));
  }
  function toggleModule(k: keyof SiteConfig["modules"]) {
    setCfg((c) => ({ ...c, modules: { ...c.modules, [k]: !c.modules[k] } }));
  }

  async function uploadLogo(which: "header" | "footer", file: File) {
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const resp = await fetch("/api/site-config/assets", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: `logo-${which}`, dataBase64: b64, mimeType: file.type, size: file.size }),
    });
    const j = await resp.json();
    if (!resp.ok) { setMsg(j.error || "Upload failed"); return; }
    setCfg((c) => ({ ...c, logos: { ...c.logos, [which]: j.url } }));
  }

  const [genBusy, setGenBusy] = useState<string>("");
  const [prompts, setPrompts] = useState<Record<string, string>>({});

  async function uploadSlide(kind: "hero" | "kiosk", idx: number, file: File) {
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const resp = await fetch("/api/site-config/assets", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: `${kind}-${idx + 1}`, dataBase64: b64, mimeType: file.type, size: file.size }),
    });
    const j = await resp.json();
    if (!resp.ok) { setMsg(j.error || "Upload failed"); return; }
    setSlide(kind, idx, j.url);
  }

  async function generateSlide(kind: "hero" | "kiosk", idx: number) {
    const key = `${kind}-${idx + 1}`;
    const prompt = prompts[key] || `${cfg.identity.tagline} \u2014 modern clinic ${kind} banner`;
    setGenBusy(key); setMsg("");
    const resp = await fetch("/api/site-config/generate-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, prompt }),
    });
    const j = await resp.json();
    setGenBusy("");
    if (!resp.ok) { setMsg(j.error || "AI generation failed"); return; }
    setSlide(kind, idx, j.url);
  }

  function setSlide(kind: "hero" | "kiosk", idx: number, url: string) {
    setCfg((c) => {
      const arr = [...(c.slides[kind] || [])];
      arr[idx] = url;
      return { ...c, slides: { ...c.slides, [kind]: arr } };
    });
  }

  async function saveAll(complete: boolean) {
    setSaving(true); setMsg("");
    const resp = await fetch("/api/site-config", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...cfg, setupComplete: complete || cfg.setupComplete }),
    });
    setSaving(false);
    if (!resp.ok) { setMsg("Could not save. Please try again."); return; }
    if (complete) { window.location.assign("/dashboard"); return; }
    setMsg("Saved.");
  }

  // Brand preset: portable JSON (identity + colors + modules) to clone a clinic's
  // look & feel quickly. Logos/slides are per-deployment uploads, so they are not
  // included (re-upload or AI-generate them after importing).
  function exportPreset() {
    const preset = { version: 1, identity: cfg.identity, colors: cfg.colors, modules: cfg.modules };
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(cfg.identity.clinicName || "clinic").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-brand-preset.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importPreset(file: File) {
    try {
      const text = await file.text();
      const p = JSON.parse(text);
      setCfg((c) => ({
        ...c,
        identity: { ...c.identity, ...(p.identity || {}) },
        colors: { ...c.colors, ...(p.colors || {}) },
        modules: { ...c.modules, ...(p.modules || {}) },
      }));
      setMsg("Brand preset imported. Review and upload logos/slides, then Finish.");
    } catch {
      setMsg("Invalid preset file.");
    }
  }

  // Saved brand themes (server gallery) + specialty sample-data seeding.
  const [presets, setPresets] = useState<Array<{ id: string; name: string; identity: SiteConfig["identity"]; colors: SiteConfig["colors"]; modules: SiteConfig["modules"] }>>([]);
  const [specialty, setSpecialty] = useState("multispecialty");
  useEffect(() => { fetch("/api/site-config/presets").then((r) => r.json()).then((j) => setPresets(j.presets || [])).catch(() => {}); }, []);
  async function saveTheme() {
    const name = window.prompt("Name this brand theme:");
    if (!name) return;
    await saveAll(false); // persist current config first so the snapshot matches
    const r = await fetch("/api/site-config/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const j = await r.json(); if (r.ok) { setPresets(j.presets || []); setMsg("Theme saved."); }
  }
  function applyTheme(p: { identity: SiteConfig["identity"]; colors: SiteConfig["colors"]; modules: SiteConfig["modules"] }) {
    setCfg((c) => ({ ...c, identity: { ...c.identity, ...p.identity }, colors: { ...c.colors, ...p.colors }, modules: { ...c.modules, ...p.modules } }));
    setMsg("Theme applied. Review and Finish.");
  }
  async function deleteTheme(id: string) {
    const r = await fetch("/api/site-config/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deleteId: id }) });
    const j = await r.json(); if (r.ok) setPresets(j.presets || []);
  }
  async function seedSpecialty() {
    setMsg("Seeding sample services…");
    const r = await fetch("/api/site-config/seed-specialty", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ specialty }) });
    const j = await r.json(); setMsg(r.ok ? `Seeded ${j.services} services, ${j.diagnoses} diagnoses, ${j.medications} medications.` : (j.error || "Seed failed"));
  }
  async function renameTheme(id: string, current: string) {
    const name = window.prompt("Rename theme:", current);
    if (!name || name.trim() === current) return;
    const r = await fetch("/api/site-config/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ renameId: id, name: name.trim() }) });
    const j = await r.json(); if (r.ok) setPresets(j.presets || []);
  }
  type SeedPack = { id: string; label: string; services: string[]; diagnoses: string[]; medications: string[] };
  const [packs, setPacks] = useState<SeedPack[]>([]);
  useEffect(() => { fetch("/api/site-config/seed-specialty").then((r) => r.json()).then((j) => setPacks(j.packs || [])).catch(() => {}); }, []);
  const selectedPack = packs.find((p) => p.id === specialty);

  return (
    <div className="min-h-screen bg-slate-50">
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">P</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Deployment Setup</h1>
            <p className="text-sm text-slate-500">Personalize this clinic’s identity, look &amp; feel and modules. You can re-run this anytime from Settings.</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition ${i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-100 text-brand-800" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
              <span className={`h-5 w-5 grid place-items-center rounded-full text-xs ${i === step ? "bg-white/25" : "bg-slate-100"}`}>{i + 1}</span>
              {s}
            </button>
          ))}
        </div>

        <div className="card card-pad">
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Clinic name"><input className="input" value={cfg.identity.clinicName} onChange={(e) => setIdentity("clinicName", e.target.value)} /></Field>
              <Field label="Corporate division / parent"><input className="input" value={cfg.identity.division} onChange={(e) => setIdentity("division", e.target.value)} placeholder="A Division of … Inc." /></Field>
              <Field label="Tagline"><input className="input" value={cfg.identity.tagline} onChange={(e) => setIdentity("tagline", e.target.value)} /></Field>
              <Field label="Phone"><input className="input" value={cfg.identity.phone} onChange={(e) => setIdentity("phone", e.target.value)} /></Field>
              <Field label="Support email"><input className="input" value={cfg.identity.email} onChange={(e) => setIdentity("email", e.target.value)} /></Field>
              <Field label="Website"><input className="input" value={cfg.identity.website} onChange={(e) => setIdentity("website", e.target.value)} /></Field>
              <Field label="Street address"><input className="input" value={cfg.identity.addressLine} onChange={(e) => setIdentity("addressLine", e.target.value)} /></Field>
              <Field label="City"><input className="input" value={cfg.identity.city} onChange={(e) => setIdentity("city", e.target.value)} /></Field>
              <Field label="State"><input className="input" value={cfg.identity.state} onChange={(e) => setIdentity("state", e.target.value)} /></Field>
              <Field label="Postal code"><input className="input" value={cfg.identity.postalCode} onChange={(e) => setIdentity("postalCode", e.target.value)} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
            <div className="rounded-lg bg-slate-100 px-3 py-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Brand themes (colors + identity + modules) — reuse across clinics.</span>
                <div className="flex gap-2">
                  <button type="button" className="chip bg-white ring-slate-200 text-slate-700 text-xs" onClick={saveTheme}>Save as theme</button>
                  <button type="button" className="chip bg-white ring-slate-200 text-slate-700 text-xs" onClick={exportPreset}>Export</button>
                  <label className="chip bg-white ring-slate-200 text-slate-700 text-xs cursor-pointer">Import
                    <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importPreset(f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-white ring-1 ring-slate-200 pl-1.5 pr-1 py-0.5 text-xs">
                      <span className="flex items-center -space-x-1" title="Theme colors">
                        <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white" style={{ background: p.colors?.primary }} />
                        <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white" style={{ background: p.colors?.secondary }} />
                        <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white" style={{ background: p.colors?.accent }} />
                      </span>
                      <button type="button" className="font-semibold text-slate-700 hover:text-brand-700" onClick={() => applyTheme(p)}>{p.name}</button>
                      <button type="button" className="text-slate-400 hover:text-brand-600 px-0.5" onClick={() => renameTheme(p.id, p.name)} title="Rename">✎</button>
                      <button type="button" className="text-slate-400 hover:text-rose-500 px-1" onClick={() => deleteTheme(p.id)} title="Delete">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <ColorField label="Primary" value={cfg.colors.primary} onChange={(v) => setColor("primary", v)} />
                  <ColorField label="Secondary" value={cfg.colors.secondary} onChange={(v) => setColor("secondary", v)} />
                  <ColorField label="Accent" value={cfg.colors.accent} onChange={(v) => setColor("accent", v)} />
                </div>
                <div className="space-y-2">
                  <LogoUpload label="Header logo (color, for light backgrounds)" url={cfg.logos.header} onFile={(f) => uploadLogo("header", f)} bg="bg-white" />
                  <LogoUpload label="Footer logo (white, for dark backgrounds)" url={cfg.logos.footer} onFile={(f) => uploadLogo("footer", f)} bg="bg-slate-900" />
                </div>
                {(["hero", "kiosk"] as const).map((kind) => (
                  <div className="pt-2" key={kind}>
                    <span className="label">{kind === "hero" ? "Hero slides (optional)" : "Kiosk slides (optional)"}</span>
                    <p className="text-xs text-slate-400 mb-2">Leave empty to use curated defaults. Upload your own, or generate with AI (needs EMERGENT_LLM_KEY).</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((i) => {
                        const key = `${kind}-${i + 1}`;
                        const url = cfg.slides[kind]?.[i];
                        return (
                          <div key={key} className="rounded-lg ring-1 ring-slate-200 p-2 space-y-1.5">
                            <div className="h-16 rounded bg-slate-100 grid place-items-center overflow-hidden">
                              {url ? <img src={url} alt={key} className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-400">Default</span>}
                            </div>
                            <input className="input text-xs h-8" placeholder="AI prompt" value={prompts[key] || ""} onChange={(e) => setPrompts((p) => ({ ...p, [key]: e.target.value }))} />
                            <div className="flex gap-1">
                              <label className="chip bg-slate-100 text-slate-700 ring-slate-200 cursor-pointer text-[11px] flex-1 justify-center">Upload
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSlide(kind, i, f); e.target.value = ""; }} />
                              </label>
                              <button type="button" className="chip bg-brand-100 text-brand-800 ring-brand-200 text-[11px] flex-1 justify-center disabled:opacity-50" disabled={genBusy === key} onClick={() => generateSlide(kind, i)}>{genBusy === key ? "…" : "AI"}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {/* Live preview */}
              <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: `linear-gradient(120deg, ${cfg.colors.secondary}, ${cfg.colors.primary})` }}>
                  <span className="text-white font-bold">{cfg.identity.clinicName || "Your Clinic"}</span>
                  <span className="text-white/80 text-xs">Preview</span>
                </div>
                <div className="p-4 space-y-3 bg-white">
                  <div className="text-2xl font-extrabold text-slate-900">Comprehensive Care, <span className="text-brand-600">Personalized</span></div>
                  <div className="text-sm text-slate-500">{cfg.identity.tagline}</div>
                  <div className="flex gap-2">
                    <button className="btn-primary" style={{ background: cfg.colors.primary }}>Book a Visit</button>
                    <button className="chip bg-brand-100 text-brand-800 ring-brand-200">Patient Portal</button>
                  </div>
                  <div className="flex gap-2">
                    <span className="chip" style={{ background: cfg.colors.accent, color: "#fff" }}>Accent chip</span>
                    <span className="chip bg-brand-600 text-white">Primary chip</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MODULE_META.map((m) => (
                  <label key={m.key} className={`flex items-start gap-3 p-3 rounded-lg ring-1 cursor-pointer transition ${cfg.modules[m.key] ? "ring-brand-300 bg-brand-50" : "ring-slate-200 bg-white"}`}>
                    <input type="checkbox" checked={cfg.modules[m.key]} onChange={() => toggleModule(m.key)} className="mt-1 h-4 w-4" />
                    <div>
                      <div className="font-semibold text-slate-900">{m.label}</div>
                      <div className="text-xs text-slate-500">{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <div className="text-sm font-semibold text-slate-800">Sample data by specialty (optional)</div>
                <p className="text-xs text-slate-500 mb-2">Seed a starter set of services/catalogs matching this clinic&apos;s specialty. Idempotent — safe to run again.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input h-9 w-auto" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                    <option value="multispecialty">Multi-specialty (default)</option>
                    <option value="rehab">Physical Rehabilitation</option>
                    <option value="primary">Primary Care</option>
                    <option value="aesthetic">Aesthetic Medicine &amp; Wellness</option>
                  </select>
                  <button type="button" className="chip bg-brand-100 text-brand-800 ring-brand-200 text-xs" onClick={seedSpecialty}>Seed sample data</button>
                </div>
                {selectedPack && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <PreviewList title={`Services (${selectedPack.services.length})`} items={selectedPack.services} />
                    <PreviewList title={`Diagnoses (${selectedPack.diagnoses.length})`} items={selectedPack.diagnoses} />
                    <PreviewList title={`Medications (${selectedPack.medications.length})`} items={selectedPack.medications} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Summary cfg={cfg} />
              <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-sm text-amber-900">
                This configures your deployment’s branding and enabled modules. It does not constitute legal, HIPAA or compliance certification.
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-4">
          <button className="chip bg-white ring-slate-200 text-slate-600 disabled:opacity-40" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Back</button>
          <div className="flex items-center gap-2">
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
            <button className="chip bg-white ring-slate-200 text-slate-600" disabled={saving} onClick={() => saveAll(false)}>{saving ? "Saving…" : "Save draft"}</button>
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next →</button>
            ) : (
              <button className="btn-primary" disabled={saving} onClick={() => saveAll(true)}>{saving ? "Finishing…" : "Finish setup"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-white ring-1 ring-slate-200 p-2">
      <div className="font-semibold text-slate-700 mb-1">{title}</div>
      <ul className="space-y-0.5 text-slate-500 list-disc list-inside">
        {items.map((it, i) => (<li key={i} className="truncate" title={it}>{it}</li>))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {  return (<label className="block"><span className="label">{label}</span>{children}</label>);
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded border border-slate-200 p-0.5" />
        <input className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}

function LogoUpload({ label, url, onFile, bg }: { label: string; url: string; onFile: (f: File) => void; bg: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`h-14 w-40 grid place-items-center rounded-lg ring-1 ring-slate-200 overflow-hidden ${bg}`}>
          {url ? <img src={url} alt="logo" className="max-h-12 max-w-[9rem] object-contain" /> : <span className="text-xs text-slate-400">No logo</span>}
        </div>
        <label className="chip bg-brand-100 text-brand-800 ring-brand-200 cursor-pointer">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}

function Summary({ cfg }: { cfg: SiteConfig }) {
  const enabled = Object.entries(cfg.modules).filter(([, v]) => v).map(([k]) => k);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      <div className="space-y-1">
        <Row k="Clinic" v={cfg.identity.clinicName} />
        <Row k="Division" v={cfg.identity.division} />
        <Row k="Phone" v={cfg.identity.phone} />
        <Row k="Address" v={`${cfg.identity.addressLine}, ${cfg.identity.city}, ${cfg.identity.state} ${cfg.identity.postalCode}`} />
        <Row k="Website" v={cfg.identity.website} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2"><span className="text-slate-500 w-24">Colors</span>
          <span className="h-5 w-5 rounded" style={{ background: cfg.colors.primary }} />
          <span className="h-5 w-5 rounded" style={{ background: cfg.colors.secondary }} />
          <span className="h-5 w-5 rounded" style={{ background: cfg.colors.accent }} />
        </div>
        <Row k="Modules" v={enabled.join(", ")} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (<div className="flex gap-2"><span className="text-slate-500 w-24 shrink-0">{k}</span><span className="font-medium text-slate-800">{v || "—"}</span></div>);
}
