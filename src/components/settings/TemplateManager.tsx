"use client";

import React, { useEffect, useState } from "react";

type Tpl = { id: string; kind: string; name: string; shared: boolean; shortcut?: string | null; data: any; mine: boolean };

const LINES = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const JOIN = (a?: string[]) => (a || []).join("\n");

export default function TemplateManager({ kind }: { kind: "charting" | "order" | "billing" }) {
  const [items, setItems] = useState<Tpl[]>([]);
  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [shared, setShared] = useState(kind === "billing");
  const [busy, setBusy] = useState(false);
  // charting fields
  const [subj, setSubj] = useState(""); const [obj, setObj] = useState(""); const [ass, setAss] = useState(""); const [pln, setPln] = useState("");
  // order fields
  const [orderType, setOrderType] = useState("lab"); const [tests, setTests] = useState(""); const [dx, setDx] = useState("");
  // billing fields
  const [codes, setCodes] = useState("");

  async function load() { const r = await fetch(`/api/templates?kind=${kind}`); if (r.ok) setItems((await r.json()).templates || []); }
  useEffect(() => { load(); }, []); // eslint-disable-line

  function buildData() {
    if (kind === "charting") return { sections: { subjective: LINES(subj), objective: LINES(obj), assessment: LINES(ass), plan: LINES(pln) } };
    if (kind === "order") return { orderType, tests: LINES(tests), diagnoses: LINES(dx).map((l) => { const [icd10, ...rest] = l.split("|"); return { icd10: icd10.trim(), description: rest.join("|").trim() || icd10.trim() }; }) };
    return { codes: LINES(codes).map((l) => { const [cpt, desc, fee] = l.split("|"); return { cpt: (cpt || "").trim(), description: (desc || "").trim(), feeCents: Math.round((Number(fee) || 0) * 100) }; }) };
  }

  async function add() {
    if (!name.trim()) return; setBusy(true);
    await fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, name, shared, shortcut, data: buildData() }) });
    setName(""); setShortcut(""); setSubj(""); setObj(""); setAss(""); setPln(""); setTests(""); setDx(""); setCodes(""); setBusy(false); load();
  }
  async function toggleShare(t: Tpl) { await fetch(`/api/templates/${t.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ shared: !t.shared }) }); load(); }
  async function del(id: string) { const r = await fetch(`/api/templates/${id}`, { method: "DELETE" }); if (!r.ok) alert((await r.json()).error || "Could not delete."); load(); }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="text-sm font-semibold text-slate-800 mb-2">
          {kind === "charting" ? "New charting template" : kind === "order" ? "New lab / imaging order template" : "New billing template"}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block"><span className="label">Template name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          {kind === "charting" && <label className="block"><span className="label">Dot-shortcut (optional)</span><input className="input" value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="e.g. lbp (use ..lbp in a note)" /></label>}
          {kind === "order" && <label className="block"><span className="label">Order type</span><select className="input" value={orderType} onChange={(e) => setOrderType(e.target.value)}><option value="lab">Lab</option><option value="imaging">Imaging</option></select></label>}
        </div>

        {kind === "charting" && (
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <label className="block"><span className="label">Subjective line items (one per line)</span><textarea className="input font-mono text-xs" rows={3} value={subj} onChange={(e) => setSubj(e.target.value)} placeholder="Use {age}, {dob}, {name}" /></label>
            <label className="block"><span className="label">Objective line items</span><textarea className="input font-mono text-xs" rows={3} value={obj} onChange={(e) => setObj(e.target.value)} /></label>
            <label className="block"><span className="label">Assessment line items</span><textarea className="input font-mono text-xs" rows={2} value={ass} onChange={(e) => setAss(e.target.value)} /></label>
            <label className="block"><span className="label">Plan line items</span><textarea className="input font-mono text-xs" rows={2} value={pln} onChange={(e) => setPln(e.target.value)} /></label>
          </div>
        )}
        {kind === "order" && (
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <label className="block"><span className="label">Tests (one per line)</span><textarea className="input font-mono text-xs" rows={4} value={tests} onChange={(e) => setTests(e.target.value)} placeholder={"CBC\nCMP\nLipid Panel"} /></label>
            <label className="block"><span className="label">Diagnoses (icd10 | description)</span><textarea className="input font-mono text-xs" rows={4} value={dx} onChange={(e) => setDx(e.target.value)} placeholder={"Z00.00 | General exam\nE78.5 | Hyperlipidemia"} /></label>
          </div>
        )}
        {kind === "billing" && (
          <label className="block mt-2"><span className="label">Codes (cpt | description | fee$)</span><textarea className="input font-mono text-xs" rows={4} value={codes} onChange={(e) => setCodes(e.target.value)} placeholder={"99214 | Office visit L4 | 175\n96372 | Therapeutic injection | 38"} /></label>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button disabled={busy} onClick={add} className="btn-primary">Save template</button>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with practice</label>
        </div>
      </div>

      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Templates</header>
        <div className="divide-y divide-slate-100">
          {items.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">No templates yet.</div>}
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-slate-900">{t.name}</span>
              {t.shortcut && <span className="chip bg-slate-100 text-slate-600 ring-slate-200 text-[10px]">..{t.shortcut}</span>}
              <span className={`chip text-[10px] ${t.shared ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{t.shared ? "Shared" : "Private"}</span>
              <span className="text-xs text-slate-400">{summary(t)}</span>
              <div className="ml-auto flex gap-3">
                {t.mine && <button onClick={() => toggleShare(t)} className="text-xs text-brand-600 hover:text-brand-800">{t.shared ? "Unshare" : "Share"}</button>}
                {t.mine && <button onClick={() => del(t.id)} className="text-xs text-rose-500 hover:text-rose-700">Delete</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function summary(t: Tpl) {
  if (t.kind === "charting") { const s = t.data?.sections || {}; const n = (s.subjective?.length || 0) + (s.objective?.length || 0) + (s.assessment?.length || 0) + (s.plan?.length || 0); return `${n} line items`; }
  if (t.kind === "order") return `${t.data?.orderType || "lab"} · ${(t.data?.tests || []).length} tests`;
  return `${(t.data?.codes || []).length} codes`;
}
