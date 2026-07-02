/** Client-safe auth types and utilities (no server API imports) */

export type Role = "provider" | "nurse" | "frontdesk" | "billing" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  credential: string | null;
};

export function roleLabel(role: Role): string {
  switch (role) {
    case "provider": return "Provider";
    case "nurse": return "Nurse / MA";
    case "frontdesk": return "Front Desk";
    case "billing": return "Billing";
    case "admin": return "Administrator";
  }
}
