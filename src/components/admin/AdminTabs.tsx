import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/agents", label: "Autonomous Agents" },
  { href: "/admin/branding", label: "Branding" },
  { href: "/admin/landing", label: "Landing Page" },
  { href: "/admin/settings", label: "Ops Settings" },
];

export default function AdminTabs({ active }: { active: string }) {
  return (
    <div className="card p-1 flex flex-wrap gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch={false}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
            active === tab.href
              ? "bg-brand-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
