import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Admin-only page to download the separate white-label installer/cloner package.
export default async function InstallerPage() {
  const user = await requireSession();
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/settings" className="text-sm text-brand-700 hover:underline">← Back to Settings</Link>
      <h1 className="text-xl font-bold text-slate-900 mt-3">Deployment Installer / Cloner</h1>
      <p className="text-sm text-slate-500 mt-1">
        Download a self-contained, re-brandable copy of this platform as a separate project. Unzip it into a new
        Emergent project (or open in VS Code / Cursor), run the one-command setup, and use the guided <code className="px-1 rounded bg-slate-100">/setup</code> wizard to brand it (name, address, colors, logos, slides) and toggle modules — no code edits required.
      </p>

      <div className="card card-pad mt-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900">clinic-installer.zip</div>
            <div className="text-sm text-slate-500">Full source (excludes node_modules / build / git). Includes README with 1-command setup and <code className="px-1 rounded bg-slate-100">.env.example</code>.</div>
          </div>
          <a href="/api/admin/installer" className="btn-primary whitespace-nowrap" download>↓ Download .zip</a>
        </div>
        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1 border-t border-slate-100 pt-3">
          <li>Unzip and, on a new project, run <code className="px-1 rounded bg-slate-100">cp .env.example .env</code> then edit values.</li>
          <li><code className="px-1 rounded bg-slate-100">yarn install</code> then <code className="px-1 rounded bg-slate-100">yarn setup</code> (generates client, syncs schema, seeds demo + catalogs).</li>
          <li><code className="px-1 rounded bg-slate-100">yarn dev</code>, log in as admin — you&apos;ll be taken to <code className="px-1 rounded bg-slate-100">/setup</code> to brand the deployment.</li>
        </ol>
        <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900">
          This package is a separate project and does not modify the running application. It is not legal, HIPAA or compliance certification — review security & compliance before real PHI use.
        </div>
      </div>
    </div>
  );
}
