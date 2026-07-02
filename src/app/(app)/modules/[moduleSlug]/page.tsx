import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { colorForCategory, fmtDateTime } from "@/lib/utils";
import { getModuleBySlug, MODULE_SERVICE_FALLBACKS } from "@/lib/modules";
import { canAccessModule, canAccessModuleWorkflow, readAdminConfig } from "@/lib/admin/store";

export default async function ModuleDetailPage({ params }: { params: Promise<{ moduleSlug: string }> }) {
  const { moduleSlug } = await params;
  const moduleDef = getModuleBySlug(moduleSlug);
  if (!moduleDef) notFound();

  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const moduleRuntime = adminConfig.modules.modules[moduleDef.key];
  const canViewModule = canAccessModule(adminConfig, user.role, moduleDef.key);
  const canSchedule = canAccessModuleWorkflow(adminConfig, user.role, moduleDef.key, "scheduling");
  const canChart = canAccessModuleWorkflow(adminConfig, user.role, moduleDef.key, "encounters");
  const canOrder = canAccessModuleWorkflow(adminConfig, user.role, moduleDef.key, "orders");
  const canBill = canAccessModuleWorkflow(adminConfig, user.role, moduleDef.key, "billing");
  const canTelehealth = canAccessModuleWorkflow(adminConfig, user.role, moduleDef.key, "telehealth") && adminConfig.modules.integrations.googleMeetTelehealth;

  if (!adminConfig.modules.moduleHubEnabled || !moduleRuntime.enabled) {
    return (
      <Shell user={user} pageTitle={`${moduleDef.title} Module`} jellyBeans={<JellyBeans />}>
        <div className="card card-pad border-amber-200 bg-amber-50 text-amber-900">
          {moduleDef.title} is currently disabled in Admin Operational Settings.
        </div>
      </Shell>
    );
  }

  if (adminConfig.modules.enforceRoleAccess && !canViewModule) {
    return (
      <Shell user={user} pageTitle={`${moduleDef.title} Module`} jellyBeans={<JellyBeans />}>
        <div className="card card-pad border-rose-200 bg-rose-50 text-rose-900">
          Access denied. Your role does not currently have permission to open this module.
        </div>
      </Shell>
    );
  }

  let providers: Array<any> = [];
  let services: Array<any> = MODULE_SERVICE_FALLBACKS;
  let upcomingAppointments: Array<any> = [];
  let recentEncounters: Array<any> = [];

  try {
    const [dbProviders, dbServices, dbUpcomingAppointments, dbRecentEncounters] = await Promise.all([
      db.user.findMany({
        where: { active: true, role: "provider" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.serviceType.findMany({
        where: { active: true, category: moduleDef.key },
        orderBy: [{ name: "asc" }],
      }),
      db.appointment.findMany({
        where: { startsAt: { gte: new Date() }, serviceType: { category: moduleDef.key } },
        include: { patient: true, provider: true, serviceType: true },
        orderBy: { startsAt: "asc" },
        take: 12,
      }),
      db.encounter.findMany({
        where: { status: { in: ["open", "signed"] } },
        include: { patient: true, provider: true, appointment: { include: { serviceType: true } } },
        orderBy: { startedAt: "desc" },
        take: 30,
      }),
    ]);

    providers = dbProviders;
    services = dbServices;
    upcomingAppointments = dbUpcomingAppointments;
    recentEncounters = dbRecentEncounters;
  } catch {
    // Keep module detail pages available even when the DB cannot initialize.
  }

  const lead = providers.find((provider) => {
    const specialty = provider.specialty?.toLowerCase() || "";
    return moduleDef.specialtySearchTerms.some((term) => specialty.includes(term));
  });

  const moduleEncounters = recentEncounters.filter((encounter) => {
    if (encounter.appointment?.serviceType?.category === moduleDef.key) return true;
    const specialty = encounter.provider?.specialty?.toLowerCase() || "";
    const complaint = encounter.chiefComplaint?.toLowerCase() || "";
    return moduleDef.specialtySearchTerms.some((term) => specialty.includes(term) || complaint.includes(term));
  });

  const moduleBillingCount = moduleEncounters.filter((encounter) => encounter.status === "signed").length;

  return (
    <Shell user={user} pageTitle={`${moduleDef.title} Module`} jellyBeans={<JellyBeans />}>
      <div className="space-y-4">
        <section className="card card-pad bg-gradient-to-br from-white to-slate-50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className={`chip ${colorForCategory(moduleDef.key)} font-semibold`}>Clinical specialty</div>
              <h2 className="text-2xl font-bold text-slate-900">{moduleDef.title}</h2>
              <p className="text-sm text-slate-600">{moduleDef.overview}</p>
              <p className="text-xs text-slate-500">Lead: {lead ? `${lead.firstName} ${lead.lastName}${lead.credential ? `, ${lead.credential}` : ""}` : moduleDef.lead}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 min-w-[240px]">
              <Stat label="Services" value={services.length} />
              <Stat label="Upcoming" value={upcomingAppointments.length} />
              <Stat label="Open notes" value={moduleEncounters.filter((encounter) => encounter.status === "open").length} />
              <Stat label="Ready billing" value={moduleBillingCount} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`chip ${moduleRuntime.allowTelehealth ? "bg-violet-100 text-violet-800 ring-violet-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Telehealth {moduleRuntime.allowTelehealth ? "enabled" : "disabled"}</span>
            <span className={`chip ${moduleRuntime.allowPortalBooking ? "bg-blue-100 text-blue-800 ring-blue-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Portal booking {moduleRuntime.allowPortalBooking ? "enabled" : "disabled"}</span>
            <span className={`chip ${moduleRuntime.requireIntakeChecklist ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Intake checklist {moduleRuntime.requireIntakeChecklist ? "required" : "optional"}</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Default visit {moduleRuntime.defaultVisitLengthMinutes} min</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Max/day {moduleRuntime.maxDailyVisits}</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Staffing {moduleRuntime.staffingTemplate}</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Intake {moduleRuntime.intakeTemplate}</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">SLA {moduleRuntime.slaFirstResponseMinutes}m/{moduleRuntime.slaCompletionHours}h</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">Signoff {moduleRuntime.requiredRoleForSignoff}</span>
            <span className={`chip ${moduleRuntime.autoEscalationEnabled ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Escalation {moduleRuntime.autoEscalationEnabled ? "on" : "off"}</span>
          </div>
        </section>

        <section className="card card-pad">
          <h3 className="font-semibold text-slate-900 mb-2">Integrated module actions</h3>
          <div className="flex flex-wrap gap-2">
            {canSchedule && <Link href="/schedule" className="btn-secondary">Schedule visits</Link>}
            <Link href={`/services?category=${moduleDef.key}`} className="btn-secondary">View service catalog</Link>
            {canChart && <Link href="/encounters" className="btn-secondary">Document encounters</Link>}
            {canOrder && <Link href="/orders" className="btn-secondary">Manage orders</Link>}
            {canBill && <Link href="/billing" className="btn-secondary">Submit billing and superbills</Link>}
            {canTelehealth && <Link href="/schedule" className="btn-secondary">Launch telehealth queue</Link>}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="card">
            <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Service set</header>
            <ul className="divide-y divide-slate-100">
              {services.map((service) => (
                <li key={service.id} className="px-4 py-3">
                  <div className="font-medium text-slate-900">{service.name}</div>
                  <div className="text-xs text-slate-500">{service.description || "No description"}</div>
                </li>
              ))}
              {services.length === 0 && <li className="px-4 py-8 text-sm text-slate-500">No active services in this module.</li>}
            </ul>
          </section>

          <section className="card">
            <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Operational focus</header>
            <div className="p-4 grid grid-cols-1 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Care pathways</div>
                <ul className="space-y-1 text-slate-600">
                  {moduleDef.focus.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Common visit reasons</div>
                <ul className="space-y-1 text-slate-600">
                  {moduleDef.patientUse.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Upcoming module appointments</header>
          <ul className="divide-y divide-slate-100">
            {upcomingAppointments.map((appointment) => (
              <li key={appointment.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">
                    <Link href={`/patients/${appointment.patientId}`} className="hover:underline text-brand-700">
                      {appointment.patient.lastName}, {appointment.patient.firstName}
                    </Link>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {appointment.reason || appointment.serviceType?.name || "Visit"} · {fmtDateTime(appointment.startsAt)}
                  </div>
                </div>
                <span className={`chip ${colorForCategory(moduleDef.key)}`}>{appointment.serviceType?.name || moduleDef.title}</span>
              </li>
            ))}
            {upcomingAppointments.length === 0 && <li className="px-4 py-8 text-sm text-slate-500">No upcoming appointments for this module.</li>}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white ring-1 ring-slate-200 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
