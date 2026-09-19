"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { SessionUser, roleLabel } from "@/lib/auth-types";
import { initials } from "@/lib/utils";
import GlobalSearch from "./GlobalSearch";
import LogoutButton from "./LogoutButton";
import TopUtilityBar from "./TopUtilityBar";
import { CLINICAL_MODULES } from "@/lib/modules";
import { useI18n } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import RecordRequestBell from "@/components/RecordRequestBell";
import QueuePanel from "@/components/QueuePanel";
import AppointmentWidget from "@/components/AppointmentWidget";
import DayAgendaWidget from "@/components/DayAgendaWidget";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: Array<{ label: string; href: string }>;
  alwaysOpen?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export default function Shell({
  user,
  children,
  pageTitle,
  jellyBeans,
  patientHeader,
}: {
  user: SessionUser;
  children: React.ReactNode;
  pageTitle?: string;
  jellyBeans?: React.ReactNode;
  patientHeader?: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("pc_sidebar_collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  function toggleCollapsed() {
    setCollapsed(v => { const n = !v; try { localStorage.setItem("pc_sidebar_collapsed", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  }

  // Front-desk alerts: poll pending website requests, badge the nav item,
  // and toast when a new one arrives.
  const [pendingCount, setPendingCount] = useState(0);
  const [alert, setAlert] = useState<string | null>(null);
  const lastSeenRef = useRef<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r = await fetch("/api/appointments/request?status=pending", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const count: number = (j.requests || []).length;
        if (stop) return;
        setPendingCount(count);
        const stored = lastSeenRef.current;
        if (stored === null) {
          // first load — seed from localStorage baseline, don't alert
          const base = Number(localStorage.getItem("pc_pending_seen") || count);
          lastSeenRef.current = base;
          if (count > base) {
            setAlert(`${count - base} new appointment request${count - base > 1 ? "s" : ""} waiting`);
          }
        } else if (count > stored) {
          setAlert(`${count - stored} new appointment request${count - stored > 1 ? "s" : ""} received`);
          lastSeenRef.current = count;
          localStorage.setItem("pc_pending_seen", String(count));
        } else {
          lastSeenRef.current = count;
          localStorage.setItem("pc_pending_seen", String(count));
        }
      } catch { /* ignore */ }
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!alert) return;
    const id = setTimeout(() => setAlert(null), 8000);
    return () => clearTimeout(id);
  }, [alert]);

  const NAV: NavItem[] = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: <Icon.Home /> },
    { label: "Analytics & Insights", href: "/analytics", icon: <Icon.Chart /> },
    { label: t("nav.schedule"), href: "/schedule", icon: <Icon.Calendar /> },
    { label: t("nav.appointmentRequests"), href: "/appointment-requests", icon: <Icon.Inbox /> },
    { label: t("nav.patients"), href: "/patients", icon: <Icon.Users /> },
    { label: t("nav.encounters"), href: "/encounters", icon: <Icon.Clipboard /> },
    { label: "Specialties", href: "/specialties", icon: <Icon.Stethoscope /> },
    { label: t("nav.orders"), href: "/orders", icon: <Icon.Beaker /> },
    {
      label: "Intake",
      href: "/intake-forms",
      icon: <Icon.Clipboard />,
      children: [
        { label: "Intake Forms", href: "/intake-forms" },
        { label: "Intake Inbox", href: "/intake-inbox" },
      ],
    },
    { label: t("nav.npiLookup"), href: "/npi-lookup", icon: <Icon.Shield /> },
    { label: t("nav.chartingSetup"), href: "/settings/charting", icon: <Icon.Beaker /> },
    {
      label: t("nav.modules"),
      href: "/modules",
      icon: <Icon.Stethoscope />,
      children: [
        { label: t("nav.moduleHub"), href: "/modules" },
        ...CLINICAL_MODULES.map((module) => ({ label: module.sidebarLabel, href: `/modules/${module.slug}` })),
      ],
    },
    { label: t("nav.pharmacy"), href: "/pharmacy", icon: <Icon.Pill /> },
    { label: "E-Prescribe", href: "/erx", icon: <Icon.Pill /> },
    { label: t("nav.pos"), href: "/pos", icon: <Icon.Register /> },
    { label: t("nav.inventory"), href: "/inventory", icon: <Icon.Box /> },
    {
      label: t("nav.billing"),
      href: "/billing",
      icon: <Icon.Dollar />,
      children: [
        { label: "Overview", href: "/billing" },
        { label: "Eligibility worklist", href: "/billing/eligibility-report" },
        { label: "Revenue Cycle", href: "/billing/revenue-cycle" },
        { label: "Bank & EFT", href: "/billing/bank-eft" },
      ],
    },
    {
      label: "Physical Rehab",
      href: "/pt",
      icon: <Icon.Dumbbell />,
      alwaysOpen: true,
      children: [
        { label: "Overview", href: "/pt" },
        { label: "PT Encounters", href: "/pt/encounters" },
        { label: "PI Intake", href: "/pt/intake" },
        { label: "PT Claims", href: "/pt/claims" },
        { label: "Reporting", href: "/pt/reporting" },
      ],
    },
    { label: t("nav.messages"), href: "/messages", icon: <Icon.Mail /> },
    { label: t("nav.services"), href: "/services", icon: <Icon.Sparkle /> },
    { label: t("nav.settings"), href: "/settings", icon: <Icon.Cog /> },
  ];
  if (user.role === "admin") {
    const settingsIndex = NAV.findIndex((item) => item.href === "/settings");
    NAV.splice(settingsIndex, 0, { label: t("nav.admin"), href: "/admin", icon: <Icon.Shield /> });
    NAV.splice(settingsIndex, 0, { label: "Database & Security", href: "/admin/database", icon: <Icon.Database /> });
    NAV.splice(settingsIndex, 0, { label: "Connection Health", href: "/admin/connections", icon: <Icon.Chart /> });
    NAV.splice(settingsIndex, 0, { label: "Enterprise Clients", href: "/admin/enterprise", icon: <Icon.Building /> });
    NAV.splice(settingsIndex, 0, { label: "Credentialing", href: "/admin/credentialing", icon: <Icon.Clipboard /> });
  }

  const isItemActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const groupedNav: NavSection[] = [
    {
      title: t("sections.clinical"),
      items: NAV.filter((item) => ["/dashboard", "/analytics", "/schedule", "/appointment-requests", "/patients", "/encounters", "/specialties", "/orders", "/intake-forms", "/npi-lookup", "/settings/charting", "/modules"].includes(item.href)),
    },
    {
      title: t("sections.pharmacyRetail"),
      items: NAV.filter((item) => ["/pharmacy", "/erx", "/pos", "/inventory"].includes(item.href)),
    },
    {
      title: t("sections.operations"),
      items: NAV.filter((item) => ["/billing", "/messages", "/services"].includes(item.href)),
    },
    {
      title: "Physical Rehab",
      items: NAV.filter((item) => ["/pt"].includes(item.href)),
    },
    {
      title: t("sections.administration"),
      items: NAV.filter((item) => ["/settings", "/admin", "/admin/database", "/admin/connections", "/admin/enterprise", "/admin/credentialing"].includes(item.href)),
    },
  ].filter((section) => section.items.length > 0);

  const activeSection = groupedNav.find((section) => section.items.some((item) => isItemActive(item.href)));
  const activeItem = NAV.find((item) => isItemActive(item.href));

  // Per-section color themes (by group order): Clinical, Pharmacy, Revenue, Admin.
  const SECTION_THEMES = [
    { dot: "bg-sky-400", text: "text-sky-200", rail: "from-sky-400 via-sky-500", chip: "bg-sky-100 text-sky-800 ring-sky-200", title: "border-sky-500", activeBar: "border-l-sky-400", activeBg: "bg-sky-400/20", groupBg: "bg-sky-400/5" },
    { dot: "bg-emerald-400", text: "text-emerald-200", rail: "from-emerald-400 via-emerald-500", chip: "bg-emerald-100 text-emerald-800 ring-emerald-200", title: "border-emerald-500", activeBar: "border-l-emerald-400", activeBg: "bg-emerald-400/20", groupBg: "bg-emerald-400/5" },
    { dot: "bg-amber-400", text: "text-amber-200", rail: "from-amber-400 via-amber-500", chip: "bg-amber-100 text-amber-800 ring-amber-200", title: "border-amber-500", activeBar: "border-l-amber-400", activeBg: "bg-amber-400/20", groupBg: "bg-amber-400/5" },
    { dot: "bg-violet-400", text: "text-violet-200", rail: "from-violet-400 via-violet-500", chip: "bg-violet-100 text-violet-800 ring-violet-200", title: "border-violet-500", activeBar: "border-l-violet-400", activeBg: "bg-violet-400/20", groupBg: "bg-violet-400/5" },
  ];
  const themeFor = (idx: number) => SECTION_THEMES[idx % SECTION_THEMES.length];
  const activeSectionIdx = Math.max(0, groupedNav.findIndex((s) => s === activeSection));
  const activeTheme = themeFor(activeSectionIdx);

  const quickLinks = [
    { label: t("quick.today"), href: "/dashboard" },
    { label: t("quick.schedule"), href: "/schedule" },
    { label: t("quick.pharmacy"), href: "/pharmacy" },
    { label: t("quick.checkout"), href: "/pos" },
    { label: t("quick.inventory"), href: "/inventory" },
    { label: t("quick.labs"), href: "/orders?type=lab" },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const renderNavGroup = (section: NavSection, mobile = false, themeIdx = 0, iconOnly = false) => {
    const theme = themeFor(themeIdx);
    return (
      <div key={section.title} className={`space-y-1.5 ${iconOnly ? "" : `rounded-lg ${theme.groupBg} p-1.5`}`}>
        {iconOnly ? (
          <div className="mx-auto my-1 h-px w-6 rounded-full bg-white/15" />
        ) : (
          <div className="flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${theme.dot}`} />
            <span className={theme.text}>{section.title}</span>
          </div>
        )}
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const active = isItemActive(item.href) || (item.children?.some((c) => isItemActive(c.href)) ?? false);
            const showBadge = item.href === "/appointment-requests" && pendingCount > 0;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={mobile ? closeMobileMenu : undefined}
                  title={iconOnly ? item.label : undefined}
                  className={`relative flex items-center rounded-md text-sm font-medium transition border-l-2 ${iconOnly ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"} ${active ? `${theme.activeBg} text-white ${theme.activeBar}` : "border-transparent text-slate-100 hover:bg-white/10 hover:text-white"}`}
                >
                  <span className={`text-slate-200 relative ${iconOnly ? "[&>svg]:h-9 [&>svg]:w-9" : ""}`}>
                    {item.icon}
                    {iconOnly && showBadge && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--navy-900)]" />}
                  </span>
                  {!iconOnly && <span className="flex-1">{item.label}</span>}
                  {!iconOnly && showBadge && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">{pendingCount}</span>
                  )}
                </Link>
                {!iconOnly && item.children && (active || item.alwaysOpen) && (
                  <div className="ml-8 mt-1 mb-1 space-y-0.5 border-l border-sky-800/60 pl-2">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href || (child.href !== item.href && pathname.startsWith(`${child.href}/`));
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          prefetch={false}
                          onClick={mobile ? closeMobileMenu : undefined}
                          className={`block rounded-md px-2 py-1 text-xs transition ${childActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Front-desk alert toast */}
      {alert && (
        <div className="fixed bottom-5 right-5 z-[100] max-w-sm">
          <a href="/appointment-requests" onClick={() => setAlert(null)}
            className="flex items-start gap-3 rounded-xl bg-white shadow-2xl ring-1 ring-red-200 border-l-4 border-red-500 p-4 hover:ring-red-300 transition">
            <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-red-100 text-red-600 grid place-items-center">🔔</span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">New appointment request</span>
              <span className="block text-sm text-slate-600">{alert}. Click to review.</span>
            </span>
          </a>
        </div>
      )}
      <div className="sticky top-0 z-30">
        <TopUtilityBar
          firstName={user.firstName}
          lastName={user.lastName}
          credential={user.credential}
          roleLabel={roleLabel(user.role)}
        />
        {/* TOP HEADER */}
        <header className="h-[var(--header-h)] bg-white/95 backdrop-blur border-b border-brand-100 flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
          {/* MOBILE MENU TOGGLE */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-700"
            title={t("shell.toggleMenu")}
          >
            {mobileMenuOpen ? <Icon.X /> : <Icon.Menu />}
          </button>

          <Link href="/dashboard" prefetch={false} className="flex items-center mr-0 sm:mr-2" title="Proactive Clinic">
            <img
              src="/pclinic-header.png?v=2"
              alt="Proactive Clinic"
              className="h-14 w-auto max-w-[220px] sm:max-w-[320px] object-contain"
              loading="lazy"
            />
          </Link>

          <div className="flex-1 hidden sm:block max-w-2xl">
            <GlobalSearch />
          </div>

          <div className="hidden lg:flex items-center gap-1.5">{jellyBeans}</div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <QueuePanel user={user} />
            <RecordRequestBell />
            <Link href="/messages" prefetch={false} className="relative h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center text-slate-500" title={t("shell.messagesTitle")}>
              <Icon.Mail />
            </Link>
            <Link href="/dashboard?view=tasks" prefetch={false} className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center text-slate-500" title={t("shell.tasksTitle")}>
              <Icon.Bell />
            </Link>
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-brand-600 grid place-items-center text-white text-xs font-semibold">
                {initials(user.firstName, user.lastName)}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-slate-900">{user.firstName} {user.lastName}{user.credential ? `, ${user.credential}` : ""}</div>
                <div className="text-[10px] text-slate-500">{roleLabel(user.role)}</div>
              </div>
              <Link href="/settings/password" prefetch={false} title="Change password" className="h-8 w-8 rounded-full hover:bg-slate-100 grid place-items-center text-slate-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>
      </div>

      <div className="flex flex-1 relative">
        {/* MOBILE MENU OVERLAY */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* SIDEBAR - DESKTOP */}
        <aside className={`${collapsed ? "w-[68px]" : "w-[var(--sidebar-w)]"} shrink-0 relative bg-gradient-to-b from-[var(--navy-900)] to-[var(--navy-800)] border-r border-sky-900/50 sticky top-[var(--chrome-h)] h-[calc(100vh-var(--chrome-h))] hidden md:flex flex-col transition-[width] duration-200`}>
          {/* Gradient accent rail (per active section), most visible when collapsed */}
          <div className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${activeTheme.rail} to-transparent ${collapsed ? "opacity-90" : "opacity-40"}`} />
          <div className={`px-3 pt-3 pb-2 border-b border-sky-900/50 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-100/80">{t("shell.workspace")}</div>
                <div className="mt-1 text-xs text-slate-200 truncate">{activeSection?.title || t("sections.clinical")} / {activeItem?.label || t("nav.dashboard")}</div>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="h-7 w-7 shrink-0 grid place-items-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${collapsed ? "rotate-180" : ""}`}><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          </div>
          <nav className="flex-1 p-2 space-y-3 overflow-y-auto no-scrollbar">
            {groupedNav.map((section, i) => renderNavGroup(section, false, i, collapsed))}
          </nav>
          {!collapsed && (
          <div className="p-3 border-t border-sky-900/50">
            <a
              href="https://www.proactivemtech.com"
              target="_blank"
              rel="noreferrer"
              className="group block rounded-lg px-1 py-1 opacity-90 hover:opacity-100 transition"
              title="Powered by ProactiveCore — Member of PUMS Ecosystem"
            >
              <img
                src="/powered-by-proactivecore.png"
                alt="Powered by ProactiveCore — Member of PUMS Ecosystem"
                className="block w-full h-auto object-contain object-center"
                loading="lazy"
              />
            </a>
          </div>
          )}
        </aside>

        {/* SIDEBAR - MOBILE DRAWER */}
        <aside
          className={`fixed md:hidden inset-y-[var(--chrome-h)] left-0 w-[232px] bg-gradient-to-b from-[var(--navy-900)] to-[var(--navy-800)] border-r border-sky-900/50 flex flex-col transition-transform duration-200 z-40 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="px-3 pt-3 pb-2 border-b border-sky-900/50">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-100/80">{t("shell.navigation")}</div>
            <div className="mt-1 text-xs text-slate-200">{activeSection?.title || t("sections.clinical")} / {activeItem?.label || t("nav.dashboard")}</div>
          </div>
          <nav className="flex-1 p-2 space-y-3 overflow-y-auto no-scrollbar">
            {groupedNav.map((section, i) => renderNavGroup(section, true, i))}
          </nav>
          <div className="p-3 border-t border-sky-900/50 space-y-3">
            <LanguageSwitcher tone="dark" />
            <a
              href="https://www.proactivemtech.com"
              target="_blank"
              rel="noreferrer"
              className="group block rounded-lg px-1 py-1 opacity-90 hover:opacity-100 transition"
              title="Powered by ProactiveCore — Member of PUMS Ecosystem"
            >
              <img
                src="/powered-by-proactivecore.png"
                alt="Powered by ProactiveCore — Member of PUMS Ecosystem"
                className="block w-full h-auto object-contain object-center"
                loading="lazy"
              />
            </a>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0 bg-gradient-to-b from-[var(--teal-100)]/35 via-white to-white overflow-x-hidden">
          {patientHeader}
          <div className="px-3 sm:px-6 pt-3 pb-1 flex flex-wrap items-center gap-2">
            <span className={`chip ring-1 ${activeTheme.chip}`}>{t("shell.section")}: {activeSection?.title || t("sections.clinical")}</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{t("shell.page")}: {activeItem?.label || t("shell.workspace")}</span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {quickLinks.map((link) => {
                const quickActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className={`chip ${quickActive ? "bg-brand-100 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          {pageTitle && (
            <div className="px-3 sm:px-6 pt-2 pb-2 flex items-center gap-3">
              <span className={`inline-block h-6 w-1.5 rounded-full ${activeTheme.dot}`} />
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">{pageTitle}</h1>
            </div>
          )}
          <div className="p-3 sm:p-6 sm:pt-3 animate-fade-in-up">{children}</div>
        </main>
      </div>
      <AppointmentWidget />
      <DayAgendaWidget />
    </div>
  );
}

const Icon = {
  Home: () => svgPath("M3 11.5L12 4l9 7.5M5 10v10h14V10"),
  Calendar: () => svgPath("M4 6h16M4 6v14h16V6M4 6V4m16 2V4M8 2v4m8-4v4"),
  Users: () => svgPath("M16 14a4 4 0 10-8 0M3 20c0-3 3-5 9-5s9 2 9 5"),
  Clipboard: () => svgPath("M9 4h6v3H9zM6 7h12v14H6zM9 12h6M9 16h6"),
  Beaker: () => svgPath("M9 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-5-10V3M9 3h6"),
  Dollar: () => svgPath("M12 3v18M17 7H9.5a2.5 2.5 0 000 5h5a2.5 2.5 0 010 5H7"),
  Mail: () => svgPath("M3 7l9 6 9-6M3 7v10h18V7M3 7l9-4 9 4"),
  Stethoscope: () => svgPath("M6 3v6a6 6 0 0012 0V3M6 9l-2 2a4 4 0 000 6 4 4 0 006 0l2-2M18 9l2 2a4 4 0 010 6 4 4 0 01-6 0l-2-2M12 15v6"),
  Pill: () => svgPath("M10.5 13.5l3-3M8 16a4 4 0 010-6l3-3a4 4 0 016 6l-3 3a4 4 0 01-6 0z"),
  Register: () => svgPath("M4 8h16M4 8l1-3h14l1 3M4 8v11h16V8M9 12h6M8 19v2M16 19v2"),
  Box: () => svgPath("M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4M21 7l-9 4M12 11v10"),
  Sparkle: () => svgPath("M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM18 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"),
  Cog: () => svgPath("M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6"),
  Shield: () => svgPath("M12 3l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4"),
  Bell: () => svgPath("M6 16V11a6 6 0 1112 0v5l1 2H5l1-2zM10 21a2 2 0 004 0"),
  Inbox: () => svgPath("M4 13l2.5-8h11L20 13M4 13v6h16v-6M4 13h5l1 2h4l1-2h5"),
  Menu: () => svgPath("M3 6h18M3 12h18M3 18h18"),
  Chart: () => svgPath("M4 4v16h16M8 16v-4M12 16V8M16 16v-6"),
  Building: () => svgPath("M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"),
  Dumbbell: () => svgPath("M6 8v8M3.5 9.5v5M18 8v8M20.5 9.5v5M6 12h12"),
  Database: () => svgPath("M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"),
  X: () => svgPath("M18 6L6 18M6 6l12 12"),
};

function svgPath(d: string) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
