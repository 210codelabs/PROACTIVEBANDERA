"use client";

import { useMemo, useState } from "react";

type UserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "provider" | "nurse" | "frontdesk" | "billing" | "admin";
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
  role: UserRecord["role"];
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

export default function AdminUsersManager({ initialUsers }: { initialUsers: UserRecord[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Could not create user");
      setSaving(false);
      return;
    }

    setUsers((prev) => [data.user, ...prev]);
    setForm(emptyForm);
    setMessage("User created successfully.");
    setSaving(false);
  }

  async function toggleUser(user: UserRecord) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: user.id, active: !user.active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Update failed");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
  }

  return (
    <div className="space-y-4">
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-slate-900">User Directory and Provisioning</h2>
          <input
            className="input max-w-xs"
            placeholder="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Specialty / NPI</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.firstName} {u.lastName}{u.credential ? `, ${u.credential}` : ""}</td>
                <td className="text-xs">{u.email}</td>
                <td><span className="chip bg-slate-100 text-slate-700 ring-slate-200">{u.role}</span></td>
                <td className="text-xs">{u.specialty || "-"} / {u.npi || "-"}</td>
                <td>
                  <span className={`chip ${u.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}`}>
                    {u.active ? "active" : "inactive"}
                  </span>
                </td>
                <td>
                  <button className="btn-secondary text-xs" onClick={() => toggleUser(u)}>
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900 mb-3">Create Staff User</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input" placeholder="First name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
          <input className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />

          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRecord["role"] }))}>
            <option value="provider">Provider</option>
            <option value="nurse">Nurse</option>
            <option value="frontdesk">Front Desk</option>
            <option value="billing">Billing</option>
            <option value="admin">Admin</option>
          </select>
          <input className="input" placeholder="Credential (MD, RN...)" value={form.credential} onChange={(e) => setForm((f) => ({ ...f, credential: e.target.value }))} />
          <input className="input" placeholder="Specialty" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />

          <input className="input" placeholder="NPI" value={form.npi} onChange={(e) => setForm((f) => ({ ...f, npi: e.target.value }))} />
          <input className="input" placeholder="Temporary password" value={form.temporaryPassword} onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))} required minLength={6} />
          <button disabled={saving} className="btn-primary">{saving ? "Creating..." : "Create User"}</button>
        </form>
        {message && <p className="text-xs text-slate-600 mt-3">{message}</p>}
      </section>
    </div>
  );
}
