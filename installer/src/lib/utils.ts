import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInYears, format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtDate(d: Date | string | null | undefined, pattern = "MMM d, yyyy") {
  if (!d) return "—";
  return format(new Date(d), pattern);
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy h:mm a");
}

export function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "h:mm a");
}

export function fmtRelative(d: Date | string | null | undefined) {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function ageFromDob(dob: Date | string): number {
  return differenceInYears(new Date(), new Date(dob));
}

export function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function fmtPhone(p: string | null | undefined) {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

export function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function colorForCategory(cat: string): string {
  switch (cat) {
    case "physical-therapy": return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "wound-care": return "bg-amber-100 text-amber-800 ring-amber-200";
    case "aesthetic-medicine": return "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200";
    case "other-services": return "bg-sky-100 text-sky-800 ring-sky-200";
    case "primary-care": return "bg-brand-100 text-brand-800 ring-brand-200";
    case "add-on-services": return "bg-indigo-100 text-indigo-800 ring-indigo-200";
    case "medication": return "bg-teal-100 text-teal-800 ring-teal-200";
    case "retail": return "bg-indigo-100 text-indigo-800 ring-indigo-200";
    case "supply": return "bg-slate-100 text-slate-700 ring-slate-200";
    case "aesthetic": return "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200";
    case "equipment": return "bg-cyan-100 text-cyan-800 ring-cyan-200";
    default: return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function colorForApptStatus(s: string): string {
  switch (s) {
    case "scheduled": return "bg-slate-100 text-slate-700";
    case "checked-in": return "bg-amber-100 text-amber-800";
    case "in-room": return "bg-violet-100 text-violet-800";
    case "completed": return "bg-emerald-100 text-emerald-800";
    case "no-show": return "bg-rose-100 text-rose-800";
    case "cancelled": return "bg-slate-200 text-slate-600 line-through";
    default: return "bg-slate-100 text-slate-700";
  }
}
