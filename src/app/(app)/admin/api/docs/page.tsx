import Shell from "@/components/Shell";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/auth";
import { SCOPES } from "@/lib/api/scopes";

export const dynamic = "force-dynamic";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-emerald-200">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, scope, children }: { method: string; path: string; scope?: string; children: React.ReactNode }) {
  const color = method === "GET" ? "bg-blue-100 text-blue-800" : method === "POST" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800";
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${color} font-mono`}>{method}</span>
        <code className="text-sm font-semibold text-slate-900">{path}</code>
        {scope && <span className="chip bg-slate-100 text-slate-600 ring-slate-200 text-[10px]">scope: {scope}</span>}
      </div>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export default async function ApiDocsPage() {
  const user = await requireAdminSession();
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://your-app-domain";
  const apiBase = `${base}/api/v1`;

  return (
    <Shell user={user} pageTitle="API Reference">
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">ProactiveClinics Integration API — Reference</h1>
          <Link href="/admin/api" prefetch={false} className="px-3 py-2 text-xs font-semibold rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300">
            ← Back to keys
          </Link>
        </div>

        <section className="card card-pad">
          <h2 className="font-semibold text-slate-900">Overview</h2>
          <p className="text-sm text-slate-600 mt-1">
            The Integration API lets external apps (for example a remote behavioral-health platform) exchange
            data with ProactiveClinics. It is a JSON REST API secured with per-app API keys. Create and manage
            keys in <b>Admin → API &amp; Integrations</b>. Each key is granted only the scopes you select.
          </p>
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Base URL</div>
            <code className="block break-all rounded bg-slate-100 p-2 text-xs mt-1">{apiBase}</code>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold text-slate-900">Authentication</h2>
          <p className="text-sm text-slate-600 mt-1">
            Every key has a public <b>Key ID</b> (<code>pck_…</code>) and a <b>secret</b> (<code>pcs_…</code>) shown
            once at creation. The bearer token you send is the two joined with a dot:
            {" "}<code>&lt;keyId&gt;.&lt;secret&gt;</code>. Send it in either header:
          </p>
          <Code>{`# Option A — Authorization header
Authorization: Bearer ${"{keyId}.{secret}"}

# Option B — X-API-Key header
X-API-Key: ${"{keyId}.{secret}"}`}</Code>
          <p className="text-sm text-slate-600 mt-3">Verify your credentials any time:</p>
          <Code>{`curl -s ${apiBase}/ping \\
  -H "Authorization: Bearer $PC_API_TOKEN"

# 200 OK
{ "ok": true, "app": "Serenity BH", "keyId": "pck_…", "scopes": ["patients:read"], "time": "…" }`}</Code>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold text-slate-900">Scopes</h2>
          <p className="text-sm text-slate-600 mt-1">A key can only call endpoints covered by its granted scopes.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {SCOPES.map((s) => (
              <div key={s.key} className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-2 text-sm">
                <code className="font-semibold text-slate-900">{s.key}</code>
                <span className="block text-xs text-slate-500">{s.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Endpoints</h2>

          <Endpoint method="GET" path="/v1/ping">Returns the authenticated app, its key ID and granted scopes. No scope required.</Endpoint>

          <Endpoint method="GET" path="/v1/patients" scope="patients:read">
            List patients. Query params: <code>query</code> (name/MRN/email search), <code>status</code>, <code>limit</code> (max 100), <code>offset</code>.
            <Code>{`curl -s "${apiBase}/patients?query=smith&limit=10" \\
  -H "Authorization: Bearer $PC_API_TOKEN"

{ "total": 3, "limit": 10, "offset": 0, "data": [ { "id": "...", "mrn": "PC-123456", "firstName": "…", "lastName": "…", "dob": "…", "sex": "M", "status": "active" } ] }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/v1/patients" scope="patients:write">
            Register a new patient. Required: <code>firstName</code>, <code>lastName</code>, <code>dob</code> (YYYY-MM-DD), <code>sex</code> (M|F|X).
            <Code>{`curl -s -X POST ${apiBase}/patients \\
  -H "Authorization: Bearer $PC_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "firstName":"Jamie","lastName":"Rivera","dob":"1990-04-12","sex":"F","email":"jamie@example.com" }'

# 201 Created
{ "data": { "id": "...", "mrn": "PC-482910", "firstName": "Jamie", "lastName": "Rivera", "status": "active" } }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/v1/patients/{id}" scope="patients:read">Fetch a single patient by id.</Endpoint>

          <Endpoint method="GET" path="/v1/appointments" scope="appointments:read">
            List appointments. Query params: <code>patientId</code>, <code>providerId</code>, <code>from</code>, <code>to</code> (YYYY-MM-DD or ISO), <code>limit</code> (max 200).
          </Endpoint>

          <Endpoint method="POST" path="/v1/appointments" scope="appointments:write">
            Book an appointment. Required: <code>patientId</code>, <code>providerId</code>, <code>day</code> (YYYY-MM-DD), <code>time</code> (HH:mm).
            Optional: <code>serviceTypeId</code>, <code>reason</code>, <code>location</code>, <code>autoShift</code> (default true — out-of-hours / double-booked times snap to the next open same-day slot; the response includes <code>shifted</code>).
            <Code>{`curl -s -X POST ${apiBase}/appointments \\
  -H "Authorization: Bearer $PC_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "patientId":"...","providerId":"...","day":"2025-07-01","time":"09:30","reason":"Therapy intake" }'

# 201 Created
{ "data": { "id": "...", "startsAt": "…", "endsAt": "…", "status": "scheduled" }, "shifted": false }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/v1/encounters" scope="encounters:read">
            List encounters (visit notes). Query params: <code>patientId</code>, <code>limit</code> (max 100), <code>offset</code>.
          </Endpoint>

          <Endpoint method="POST" path="/v1/encounters" scope="encounters:write">
            Create an encounter/visit note. Required: <code>patientId</code>, <code>providerId</code>. Optional SOAP body:
            <code>visitType</code>, <code>chiefComplaint</code>, <code>subjective</code>, <code>objective</code>, <code>assessment</code>, <code>plan</code>.
          </Endpoint>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold text-slate-900">Errors &amp; status codes</h2>
          <p className="text-sm text-slate-600 mt-1">Errors return a consistent JSON shape:</p>
          <Code>{`{ "error": { "code": "forbidden", "message": "This API key is missing the required scope 'patients:read'." } }`}</Code>
          <ul className="mt-3 text-sm text-slate-600 space-y-1 list-disc pl-5">
            <li><code>400 invalid_body</code> — request validation failed.</li>
            <li><code>401 unauthorized</code> — missing / invalid key or secret.</li>
            <li><code>403 forbidden</code> — key lacks the required scope.</li>
            <li><code>404 not_found</code> — resource does not exist.</li>
            <li><code>409 conflict</code> — scheduling clash that could not be auto-shifted.</li>
            <li><code>422 unschedulable</code> — no valid slot for the requested time.</li>
            <li><code>429 rate_limited</code> — too many requests; back off and retry.</li>
            <li><code>500 / 503</code> — server / temporary error.</li>
          </ul>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold text-slate-900">CORS</h2>
          <p className="text-sm text-slate-600 mt-1">
            All <code>/api/v1</code> endpoints send permissive CORS headers and answer <code>OPTIONS</code> preflight,
            so browser-based partner apps can call them directly. Keep secrets server-side whenever possible.
          </p>
        </section>
      </div>
    </Shell>
  );
}
