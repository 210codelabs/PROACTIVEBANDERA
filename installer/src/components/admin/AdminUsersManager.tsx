"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type RoleKey = "provider" | "nurse" | "frontdesk" | "billing" | "admin";

type UserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
  credential: string | null;
  specialty: string | null;
  npi: string | null;
  active: boolean;
  createdAt: string;
};

type CreateForm = {
  email: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
  credential: string;
  specialty: string;
  npi: string;
  temporaryPassword: string;
};

type EditForm = {
  firstName: string;
  lastName: string;
  email: string;
  role: RoleKey;
  credential: string;
  specialty: string;
  npi: string;
  temporaryPassword: string;
};

const emptyForm: CreateForm = {
  email: "",
  firstName: "",
  lastName: "",
  role: "frontdesk",
  credential: "",
  specialty: "",
  npi: "",
  temporaryPassword: "",
};

const ROLE_OPTIONS: Array<{ value: RoleKey; label: string }> = [
  { value: "provider", label: "Provider" },
  { value: "nurse", label: "Nurse" },
  { value: "frontdesk", label: "Front Desk" },
  { value: "billing", label: "Billing" },
  { value: "admin", label: "Admin" },
];

function fullName(u: UserRecord) {
  return `${u.firstName} ${u.lastName}${u.credential ? `, ${u.credential}` : ""}`;
}

export default function AdminUsersManager({ initialUsers }: { initialUsers: UserRecord[] }) {
  const { t } = useI18n();
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // ---- edit modal state ----
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ---- migration state ----
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [deactivateSource, setDeactivateSource] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [confirmMigrate, setConfirmMigrate] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.firstName, u.lastName, u.email, u.role, u.specialty ?? "", u.npi ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, users]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ kind: "error", text: data.error ?? "Could not create user" });
      setSaving(false);
      return;
    }
    setUsers((prev) => [data.user, ...prev]);
    setForm(emptyForm);
    setMessage({ kind: "ok", text: `${data.user.firstName} ${data.user.lastName} ✓` });
    setSaving(false);
  }

  async function toggleUser(user: UserRecord) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: user.id, active: !user.active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ kind: "error", text: data.error ?? "Update failed" });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
  }

  function openEdit(user: UserRecord) {
    setEditing(user);
    setEditError(null);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      credential: user.credential ?? "",
      specialty: user.specialty ?? "",
      npi: user.npi ?? "",
      temporaryPassword: "",
    });
  }

  function closeEdit() {
    setEditing(null);
    setEditForm(null);
    setEditError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editForm) return;
    setEditSaving(true);
    setEditError(null);

    const payload: Record<string, unknown> = {
      id: editing.id,
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      role: editForm.role,
      credential: editForm.credential.trim() ? editForm.credential.trim() : null,
      specialty: editForm.specialty.trim() ? editForm.specialty.trim() : null,
      npi: editForm.npi.trim() ? editForm.npi.trim() : null,
    };
    if (editForm.temporaryPassword.trim()) {
      payload.temporaryPassword = editForm.temporaryPassword.trim();
    }

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEditError(data.error ?? "Could not save changes");
      setEditSaving(false);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === editing.id ? data.user : u)));
    setMessage({ kind: "ok", text: `${data.user.firstName} ${data.user.lastName} ✓` });
    setEditSaving(false);
    closeEdit();
  }

  async function runMigration() {
    if (!sourceId || !targetId) return;
    setMigrating(true);
    setMigrateError(null);
    setMigrateResult(null);
    const res = await fetch("/api/admin/users/migrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId, targetId, deactivateSource }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMigrateError(data.error ?? "Migration failed");
      setMigrating(false);
      setConfirmMigrate(false);
      return;
    }
    const mv = data.moved;
    setMigrateResult(
      `${data.total} → ${data.source.name} ⇒ ${data.target.name}: ` +
        `${mv.appointments} · ${mv.encounters} · ${mv.notes} · ${mv.orders} · ${mv.messagesFrom + mv.messagesTo} · ${mv.auditLogs}` +
        (mv.sourceDeactivated ? " ✓" : ""),
    );
    if (data.moved.sourceDeactivated) {
      setUsers((prev) => prev.map((u) => (u.id === sourceId ? { ...u, active: false } : u)));
    }
    setMigrating(false);
    setConfirmMigrate(false);
    setSourceId("");
    setTargetId("");
  }

  const sourceUser = users.find((u) => u.id === sourceId) || null;
  const targetUser = users.find((u) => u.id === targetId) || null;
  const migrateReady = Boolean(sourceId && targetId && sourceId !== targetId);

  return (
    <div className="space-y-4" data-testid="admin-users-manager">
      {message && (
        <div
          data-testid="users-banner"
          className={`rounded-md px-3 py-2 text-sm ring-1 ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Directory + inline edit */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-slate-900">{t("adminUsers.directoryTitle")}</h2>
          <input
            data-testid="users-search-input"
            className="input max-w-xs"
            placeholder={t("adminUsers.searchUsers")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="data min-w-[820px]">
            <thead>
              <tr>
                <th>{t("adminUsers.name")}</th>
                <th>{t("adminUsers.email")}</th>
                <th>{t("adminUsers.role")}</th>
                <th>{t("adminUsers.specialtyNpi")}</th>
                <th>{t("adminUsers.status")}</th>
                <th className="text-right">{t("adminUsers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="font-medium">{fullName(u)}</td>
                  <td className="text-xs">{u.email}</td>
                  <td>
                    <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{u.role}</span>
                  </td>
                  <td className="text-xs">{u.specialty || "-"} / {u.npi || "-"}</td>
                  <td>
                    <span
                      className={`chip ${
                        u.active
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          : "bg-rose-100 text-rose-800 ring-rose-200"
                      }`}
                    >
                      {u.active ? t("adminUsers.active") : t("adminUsers.inactive")}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        data-testid={`edit-user-${u.id}`}
                        className="btn-secondary text-xs"
                        onClick={() => openEdit(u)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        data-testid={`toggle-user-${u.id}`}
                        className="btn-secondary text-xs"
                        onClick={() => toggleUser(u)}
                      >
                        {u.active ? t("common.deactivate") : t("common.activate")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-slate-500 py-6">
                    {t("adminUsers.noMatch")} “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Migrate / merge */}
      <section className="card card-pad space-y-3" data-testid="user-migrate-panel">
        <div>
          <h2 className="font-semibold text-slate-900">{t("adminUsers.migrateTitle")}</h2>
          <p className="text-xs text-slate-500 mt-1">{t("adminUsers.migrateDesc")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("adminUsers.sourceUser")}</label>
            <select
              data-testid="migrate-source-select"
              className="input"
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setConfirmMigrate(false);
                setMigrateResult(null);
              }}
            >
              <option value="">{t("adminUsers.selectSource")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.role}) — {u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("adminUsers.targetUser")}</label>
            <select
              data-testid="migrate-target-select"
              className="input"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setConfirmMigrate(false);
                setMigrateResult(null);
              }}
            >
              <option value="">{t("adminUsers.selectTarget")}</option>
              {users
                .filter((u) => u.id !== sourceId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role}) — {u.email}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            data-testid="migrate-deactivate-checkbox"
            type="checkbox"
            checked={deactivateSource}
            onChange={(e) => setDeactivateSource(e.target.checked)}
          />
          {t("adminUsers.deactivateAfter")}
        </label>

        {migrateError && (
          <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">
            {migrateError}
          </div>
        )}
        {migrateResult && (
          <div
            data-testid="migrate-result"
            className="rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 px-3 py-2 text-sm"
          >
            {migrateResult}
          </div>
        )}

        {!confirmMigrate ? (
          <button
            data-testid="migrate-start-btn"
            className="btn-primary"
            disabled={!migrateReady}
            onClick={() => setConfirmMigrate(true)}
          >
            {t("adminUsers.reviewMigration")}
          </button>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
            <p className="text-sm text-amber-900">
              <strong>{sourceUser ? `${sourceUser.firstName} ${sourceUser.lastName}` : ""}</strong> ⇒{" "}
              <strong>{targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : ""}</strong>
            </p>
            <div className="flex gap-2">
              <button
                data-testid="migrate-confirm-btn"
                className="btn-primary"
                disabled={migrating}
                onClick={runMigration}
              >
                {migrating ? t("adminUsers.migrating") : t("adminUsers.confirmMigration")}
              </button>
              <button
                data-testid="migrate-cancel-btn"
                className="btn-secondary"
                disabled={migrating}
                onClick={() => setConfirmMigrate(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Create */}
      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900 mb-3">{t("adminUsers.createTitle")}</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input data-testid="create-firstname" className="input" placeholder={t("adminUsers.firstName")} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
          <input data-testid="create-lastname" className="input" placeholder={t("adminUsers.lastName")} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
          <input data-testid="create-email" className="input" placeholder={t("adminUsers.email")} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />

          <select data-testid="create-role" className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleKey }))}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <input data-testid="create-credential" className="input" placeholder={t("adminUsers.credential")} value={form.credential} onChange={(e) => setForm((f) => ({ ...f, credential: e.target.value }))} />
          <input data-testid="create-specialty" className="input" placeholder={t("adminUsers.specialty")} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />

          <input data-testid="create-npi" className="input" placeholder={t("adminUsers.npi")} value={form.npi} onChange={(e) => setForm((f) => ({ ...f, npi: e.target.value }))} />
          <input data-testid="create-password" className="input" placeholder={t("adminUsers.tempPassword")} value={form.temporaryPassword} onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))} required minLength={6} />
          <button data-testid="create-user-btn" disabled={saving} className="btn-primary">{saving ? t("adminUsers.creating") : t("adminUsers.createUser")}</button>
        </form>
      </section>

      {/* Edit modal */}
      {editing && editForm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          data-testid="edit-user-modal"
          onClick={closeEdit}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveEdit}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t("adminUsers.editUser")}</h3>
                <p className="text-xs text-slate-500">{editing.email}</p>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={closeEdit} data-testid="edit-close-btn">
                {t("common.close")}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">{t("adminUsers.firstName")}</label>
                <input data-testid="edit-firstname" className="input" value={editForm.firstName} onChange={(e) => setEditForm((f) => f && { ...f, firstName: e.target.value })} required />
              </div>
              <div>
                <label className="label">{t("adminUsers.lastName")}</label>
                <input data-testid="edit-lastname" className="input" value={editForm.lastName} onChange={(e) => setEditForm((f) => f && { ...f, lastName: e.target.value })} required />
              </div>
              <div>
                <label className="label">{t("adminUsers.email")}</label>
                <input data-testid="edit-email" type="email" className="input" value={editForm.email} onChange={(e) => setEditForm((f) => f && { ...f, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">{t("adminUsers.role")}</label>
                <select data-testid="edit-role" className="input" value={editForm.role} onChange={(e) => setEditForm((f) => f && { ...f, role: e.target.value as RoleKey })}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("adminUsers.specialty")}</label>
                <input data-testid="edit-specialty" className="input" value={editForm.specialty} onChange={(e) => setEditForm((f) => f && { ...f, specialty: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("adminUsers.credential")}</label>
                <input data-testid="edit-credential" className="input" value={editForm.credential} onChange={(e) => setEditForm((f) => f && { ...f, credential: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("adminUsers.npi")}</label>
                <input data-testid="edit-npi" className="input" value={editForm.npi} onChange={(e) => setEditForm((f) => f && { ...f, npi: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("adminUsers.resetPassword")}</label>
                <input data-testid="edit-password" className="input" placeholder={t("adminUsers.keepCurrent")} value={editForm.temporaryPassword} onChange={(e) => setEditForm((f) => f && { ...f, temporaryPassword: e.target.value })} />
              </div>
            </div>

            {editError && (
              <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{editError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={closeEdit} disabled={editSaving}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" data-testid="edit-save-btn" disabled={editSaving}>
                {editSaving ? t("common.saving") : t("adminUsers.saveChanges")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
