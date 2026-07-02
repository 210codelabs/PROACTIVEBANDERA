"use client";

import { useState } from "react";

type RoleKey = "provider" | "nurse" | "frontdesk" | "billing" | "admin";

type PermissionSet = {
  dashboard: boolean;
  scheduling: boolean;
  patientsRead: boolean;
  patientsWrite: boolean;
  encountersWrite: boolean;
  ordersWrite: boolean;
  billingRead: boolean;
  billingWrite: boolean;
  messaging: boolean;
  adminAccess: boolean;
};

type RoleMatrix = Record<RoleKey, PermissionSet>;

const columns: Array<keyof PermissionSet> = [
  "dashboard",
  "scheduling",
  "patientsRead",
  "patientsWrite",
  "encountersWrite",
  "ordersWrite",
  "billingRead",
  "billingWrite",
  "messaging",
  "adminAccess",
];

export default function AdminRolesManager({ initialRoles }: { initialRoles: RoleMatrix }) {
  const [roles, setRoles] = useState<RoleMatrix>(initialRoles);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(role: RoleKey, permission: keyof PermissionSet) {
    setRoles((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role][permission],
      },
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/roles", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roles }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to save role matrix");
      setSaving(false);
      return;
    }
    setRoles(data.roles);
    setMessage("Role matrix saved.");
    setSaving(false);
  }

  return (
    <section className="card card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Role Permission Matrix</h2>
        <button disabled={saving} onClick={save} className="btn-primary">{saving ? "Saving..." : "Save Permissions"}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="data min-w-[900px]">
          <thead>
            <tr>
              <th>Permission</th>
              <th>Provider</th>
              <th>Nurse</th>
              <th>Front Desk</th>
              <th>Billing</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col}>
                <td className="font-medium">{col}</td>
                {(["provider", "nurse", "frontdesk", "billing", "admin"] as RoleKey[]).map((role) => (
                  <td key={`${role}-${col}`}>
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={roles[role][col]} onChange={() => toggle(role, col)} />
                      {roles[role][col] ? "allow" : "deny"}
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </section>
  );
}
