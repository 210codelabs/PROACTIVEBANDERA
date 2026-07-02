import Shell from "@/components/Shell";
import AdminTabs from "@/components/admin/AdminTabs";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";
import { CLINICAL_MODULES } from "@/lib/modules";

export default async function AdminOverviewPage() {
  const user = await requireAdminSession();
  const config = await readAdminConfig();

  let users = 0;
  let activePatients = 0;
  let encounters = 0;
  let appointments = 0;
  let openOrders = 0;
  let dataUnavailable = false;
  const activeModules = CLINICAL_MODULES.filter((module) => config.modules.modules[module.key].enabled).length;
  const activeIntegrations = Object.values(config.modules.integrations).filter(Boolean).length;

  try {
    const results = await Promise.allSettled([
      db.user.count(),
      db.patient.count({ where: { status: "active" } }),
      db.encounter.count(),
      db.appointment.count(),
      db.order.count({ where: { status: "pending" } }),
    ]);

    users = results[0].status === "fulfilled" ? results[0].value : 0;
    activePatients = results[1].status === "fulfilled" ? results[1].value : 0;
    encounters = results[2].status === "fulfilled" ? results[2].value : 0;
    appointments = results[3].status === "fulfilled" ? results[3].value : 0;
    openOrders = results[4].status === "fulfilled" ? results[4].value : 0;
    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    dataUnavailable = true;
  }

  return (
    <Shell user={user} pageTitle="Admin Console">
      <div className="space-y-4">
        {dataUnavailable && (
          <div className="card card-pad border-amber-200 bg-amber-50 text-amber-900">
            Admin metrics are temporarily unavailable.
          </div>
        )}
        <AdminTabs active="/admin" />
        <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Stat label="Staff Users" value={users} />
          <Stat label="Active Patients" value={activePatients} />
          <Stat label="Encounters" value={encounters} />
          <Stat label="Appointments" value={appointments} />
          <Stat label="Open Orders" value={openOrders} />
        </section>
        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Stat label="Active Modules" value={activeModules} />
          <Stat label="Enabled Integrations" value={activeIntegrations} />
          <Stat label="Portal Controls" value={Object.values(config.portal).filter(Boolean).length} />
          <Stat label="Role Profiles" value={Object.keys(config.roles).length} />
        </section>
        <section className="card card-pad grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="font-semibold">Brand Status</h2>
            <p className="text-sm text-slate-600 mt-2">App name: {config.branding.appName}</p>
            <p className="text-sm text-slate-600">Support: {config.branding.supportEmail}</p>
            <p className="text-sm text-slate-600">Portal enabled: {config.portal.portalEnabled ? "Yes" : "No"}</p>
          </div>
          <div>
            <h2 className="font-semibold">Compliance Snapshot</h2>
            <p className="text-sm text-slate-600 mt-2">MFA for admins: {config.security.mfaRequiredForAdmins ? "Required" : "Optional"}</p>
            <p className="text-sm text-slate-600">Session timeout: {config.security.sessionTimeoutMinutes} minutes</p>
            <p className="text-sm text-slate-600">Audit retention: {config.security.auditRetentionDays} days</p>
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="font-semibold">Module and Integration Snapshot</h2>
          <div className={`mt-3 rounded-md ring-1 p-2 text-xs ${config.modules.enforceRoleAccess ? "bg-blue-50 text-blue-800 ring-blue-200" : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
            Hard role enforcement for modules: {config.modules.enforceRoleAccess ? "enabled" : "disabled"}
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {CLINICAL_MODULES.map((module) => {
              const item = config.modules.modules[module.key];
              return (
                <div key={module.key} className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">{module.title}</div>
                    <span className={`chip ${item.enabled ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}`}>{item.enabled ? "active" : "inactive"}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Visit length {item.defaultVisitLengthMinutes} min · Max/day {item.maxDailyVisits}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Staffing {item.staffingTemplate} · Intake {item.intakeTemplate}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    SLA {item.slaFirstResponseMinutes}m/{item.slaCompletionHours}h · Signoff {item.requiredRoleForSignoff}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card card-pad">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
