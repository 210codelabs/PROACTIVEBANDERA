"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GUIDE_SECTIONS } from "@/lib/guide/content";

export default function GuideNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isOverview = pathname === "/guide";

  const links = (
    <nav className="space-y-1">
      <Link
        href="/guide"
        onClick={() => setOpen(false)}
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${isOverview ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-white hover:ring-1 hover:ring-slate-200"}`}
      >
        Overview
      </Link>
      {GUIDE_SECTIONS.map((s, i) => {
        const active = pathname === `/guide/${s.slug}`;
        return (
          <Link
            key={s.slug}
            href={`/guide/${s.slug}`}
            onClick={() => setOpen(false)}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-white hover:ring-1 hover:ring-slate-200"}`}
          >
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold ${active ? "bg-white/20" : "bg-brand-100 text-brand-700"}`}>{i + 1}</span>
            <span className="leading-snug">{s.title}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <button
        onClick={() => setOpen((v) => !v)
        }
        className="lg:hidden w-full mb-3 inline-flex items-center justify-between rounded-lg bg-white ring-1 ring-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
      >
        Guide sections
        <svg className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <div className={`${open ? "block" : "hidden"} lg:block rounded-xl bg-slate-100/60 ring-1 ring-slate-200 p-2`}>{links}</div>
    </aside>
  );
}
