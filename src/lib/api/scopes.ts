// Scope catalog for the public Integration API. Each API key is granted a
// subset of these scopes from Admin → API & Integrations.
export type ApiScope =
  | "patients:read"
  | "patients:write"
  | "appointments:read"
  | "appointments:write"
  | "encounters:read"
  | "encounters:write";

export const SCOPES: { key: ApiScope; label: string; group: string; description: string }[] = [
  { key: "patients:read", label: "Read patients", group: "Patients", description: "List and fetch patient demographics." },
  { key: "patients:write", label: "Create patients", group: "Patients", description: "Register new patients." },
  { key: "appointments:read", label: "Read appointments", group: "Scheduling", description: "List appointments and availability." },
  { key: "appointments:write", label: "Create appointments", group: "Scheduling", description: "Book appointments (auto-shifts to the next open same-day slot)." },
  { key: "encounters:read", label: "Read encounters", group: "Clinical", description: "List and fetch encounter/visit notes." },
  { key: "encounters:write", label: "Create encounters", group: "Clinical", description: "Create encounter/visit notes." },
];

export const SCOPE_KEYS: ApiScope[] = SCOPES.map((s) => s.key);

export function isValidScope(s: string): s is ApiScope {
  return (SCOPE_KEYS as string[]).includes(s);
}
