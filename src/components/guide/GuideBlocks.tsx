import type { GuideBlock } from "@/lib/guide/content";

export default function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        if (b.type === "p") {
          return <p key={i} className="text-[15px] leading-relaxed text-slate-600">{b.text}</p>;
        }
        if (b.type === "subhead") {
          return <h3 key={i} className="text-lg font-bold text-brand-900 pt-2">{b.text}</h3>;
        }
        if (b.type === "steps") {
          return (
            <div key={i} className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
              {b.title && <div className="text-xs font-bold uppercase tracking-wider text-brand-700 mb-2">{b.title}</div>}
              <ol className="space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3 text-[15px] text-slate-700">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white text-xs font-bold">{j + 1}</span>
                    <span className="leading-relaxed">{it}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        }
        if (b.type === "tip") {
          const warn = b.kind === "warn";
          return (
            <div key={i} className={`rounded-xl p-4 text-[14px] leading-relaxed ring-1 ${warn ? "bg-amber-50 ring-amber-200 text-amber-900" : "bg-sky-50 ring-sky-200 text-sky-900"}`}>
              <span className="font-bold mr-1">{warn ? "Important:" : "Tip:"}</span>{b.text}
            </div>
          );
        }
        if (b.type === "shot") {
          return (
            <figure key={i} className="rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm">
              <img src={b.src} alt={b.caption} className="w-full block" loading="lazy" />
              <figcaption className="px-4 py-2.5 text-xs text-slate-500 border-t border-slate-100">{b.caption}</figcaption>
            </figure>
          );
        }
        return null;
      })}
    </div>
  );
}
