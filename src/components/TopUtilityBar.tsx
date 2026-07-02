"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function TopUtilityBar({
  firstName,
  lastName,
  credential,
  roleLabel,
}: {
  firstName: string;
  lastName: string;
  credential?: string | null;
  roleLabel: string;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [location, setLocation] = useState("Locating...");

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation("Geolocation unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(3);
        const lon = pos.coords.longitude.toFixed(3);
        setLocation(`${lat}, ${lon}`);
      },
      () => setLocation("Location permission blocked"),
      { enableHighAccuracy: false, timeout: 4500, maximumAge: 120000 }
    );
  }, []);

  const clock = useMemo(
    () => {
      if (!now) return "--:--:--";
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now);
    },
    [now]
  );

  return (
    <div className="h-[var(--topbar-h)] bg-[var(--navy-900)] text-slate-100 border-b border-sky-900/60 px-4">
      <div className="h-full flex items-center justify-between gap-3 text-xs">
        <div className="hidden md:flex items-center gap-4 text-slate-200">
          <InfoPill icon={<Icon.Clock />} text={clock} />
          <InfoPill icon={<Icon.Pin />} text={location} />
          <InfoPill icon={<Icon.Phone />} text="(305) 555-0182" />
        </div>
        <div className="ml-auto">
          <MyAccountMenu
            firstName={firstName}
            lastName={lastName}
            credential={credential}
            roleLabel={roleLabel}
          />
        </div>
      </div>
    </div>
  );
}

function InfoPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 ring-1 ring-white/10">
      <span className="text-teal-200">{icon}</span>
      <span suppressHydrationWarning>{text}</span>
    </div>
  );
}

function MyAccountMenu({
  firstName,
  lastName,
  credential,
  roleLabel,
}: {
  firstName: string;
  lastName: string;
  credential?: string | null;
  roleLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-teal-500/20 text-teal-100 ring-1 ring-teal-300/30 hover:bg-teal-500/30 transition"
        suppressHydrationWarning
      >
        <span className="h-6 w-6 rounded-full bg-teal-400 text-[11px] font-bold text-[var(--navy-900)] grid place-items-center">{firstName.charAt(0)}{lastName.charAt(0)}</span>
        <span className="font-semibold">My Account</span>
        <Icon.Chevron />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-slate-200">
            <div className="font-semibold text-slate-900">{firstName} {lastName}{credential ? `, ${credential}` : ""}</div>
            <div className="text-xs text-slate-500">{roleLabel}</div>
          </div>
          <div className="p-2 space-y-1 text-sm">
            <MenuLink href="/settings" label="Profile & Preferences" />
            <MenuLink href="/messages" label="Inbox & Notifications" />
            <MenuLink href="/dashboard" label="Workspace Overview" />
            <MenuLink href="/billing" label="Financial Center" />
          </div>
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={logout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white bg-[var(--navy-800)] hover:bg-[var(--navy-900)] transition"
            >
              <Icon.Logout />
              Sign out securely
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="block rounded-md px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-teal-50 transition"
    >
      {label}
    </Link>
  );
}

const Icon = {
  Clock: () => svgPath("M12 7v5l3 2M12 2a10 10 0 100 20 10 10 0 000-20"),
  Pin: () => svgPath("M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 13a3 3 0 100-6 3 3 0 000 6"),
  Phone: () => svgPath("M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7l.5 3a2 2 0 01-.6 1.8l-1.3 1.3a16 16 0 006 6l1.3-1.3a2 2 0 011.8-.6l3 .5A2 2 0 0122 16.9z"),
  Chevron: () => svgPath("M6 9l6 6 6-6"),
  Logout: () => svgPath("M15 12H3m0 0l4-4m-4 4l4 4M21 5v14a2 2 0 01-2 2h-6"),
};

function svgPath(d: string) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}