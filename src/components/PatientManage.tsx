"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const CAN_EDIT = ["admin", "provider", "nurse", "frontdesk"];
const CAN_ARCHIVE = ["admin", "frontdesk", "provider"];

type Patient = Record<string, any>;

const FIELDS: { id: string; label: string; type?: string; full?: boolean }[] = [
  { id: "firstName", label: "First Name" },
  { id: "lastName", label: "Last Name" },
  { id: "dob", label: "Date of Birth", type: "date" },
  { id: "sex", label: "Sex" },
  { id: "pronouns", label: "Pronouns" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "addressLine1", label: "Address Line 1", full: true },
  { id: "addressLine2", label: "Address Line 2", full: true },
  { id: "city", label: "City" },
  { id: "state", label: "State" },
  { id: "postalCode", label: "Postal Code" },
  { id: "country", label: "Country" },
  { id: "preferredLang", label: "Preferred Language" },
  { id: "race", label: "Race" },
  { id: "ethnicity", label: "Ethnicity" },
  { id: "maritalStatus", label: "Marital Status" },
  { id: "insurerName", label: "Insurer" },
  { id: "insurerPlan", label: "Plan" },
  { id: "memberId", label: "Member ID" },
  { id: "groupNumber", label: "Group #" },
  { id: "payerId", label: "Stedi Payer ID (eligibility)" },
  { id: "ecName", label: "Emergency Contact Name" },
  { id: "ecRelation", label: "Emergency Relation" },
  { id: "ecPhone", label: "Emergency Phone" },
  { id: "ecPhoneAlt", label: "Emergency Alt Phone" },
  { id: "ecEmail", label: "Emergency Email" },
];

function toDateInput(v: any): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function PatientManage({ patient, role }: { patient: Patient; role: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Patient>(() => {
    const f: Patient = {};
    for (const { id } of FIELDS) f[id] = id === "dob" ? toDateInput(patient[id]) : patient[id] || "";
    return f;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = CAN_EDIT.includes(role);
  const canArchive = CAN_ARCHIVE.includes(role);
  const canDelete = role === "admin";
  const archived = patient.status === "archived" || patient.status === "inactive";

  const set = (id: string, v: string) => setForm((p) => ({ ...p, [id]: v }));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Could not save.");
      else { setEditing(false); router.refresh(); }
    } catch { setMsg("Network error."); }
    finally { setBusy(false); }
  }

  async function changeStatus(status: string) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Could not update status.");
      else router.refresh();
    } catch { setMsg("Network error."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/patients/${patient.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Could not delete."); setBusy(false); return; }
      router.push("/patients");
    } catch { setMsg("Network error."); setBusy(false); }
  }

  return (
    <section className="card mb-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">Manage Patient</span>
          {archived && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-700">Archived</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
              Edit
            </button>
          )}
          {canArchive && !editing && (
            archived ? (
              <button onClick={() => changeStatus("active")} disabled={busy} className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700 disabled:opacity-50">
                Reactivate
              </button>
            ) : (
              <button onClick={() => changeStatus("archived")} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 disabled:opacity-50">
                Archive
              </button>
            )
          )}
          {canDelete && !editing && (
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">
              Delete
            </button>
          )}
        </div>
      </header>

      {!canEdit && !canArchive && (
        <div className="px-4 py-3 text-sm text-slate-500">Your role has read-only access to patient records.</div>
      )}

      {editing && (
        <div className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.id} className={f.full ? "sm:col-span-2 lg:col-span-3" : ""}>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={form[f.id] || ""}
                  onChange={(e) => set(f.id, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            ))}
          </div>
          {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setEditing(false); setMsg(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={save} disabled={busy} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {!editing && msg && <div className="px-4 py-2 text-sm text-red-600">{msg}</div>}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Permanently delete patient?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove <b>{patient.firstName} {patient.lastName}</b> (MRN {patient.mrn}) and all their
              encounters, orders, documents, and history. This cannot be undone. Consider <b>Archive</b> instead.
            </p>
            {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setConfirmDelete(false); setMsg(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={remove} disabled={busy} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
