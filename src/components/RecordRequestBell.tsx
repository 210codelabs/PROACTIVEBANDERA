"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function RecordRequestBell() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/records-requests/count");
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setPending(json.pending || 0);
      } catch {}
    }
    poll();
    const iv = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return (
    <Link
      href="/records-requests"
      prefetch={false}
      title={pending ? `${pending} pending attorney record request(s)` : "Attorney record requests"}
      className="relative h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center text-slate-500"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
      {pending > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-red-600 text-white text-[10px] font-bold ring-2 ring-white animate-pulse">
          {pending > 9 ? "9+" : pending}
        </span>
      )}
    </Link>
  );
}
