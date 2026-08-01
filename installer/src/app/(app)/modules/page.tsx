import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { colorForCategory, fmtDateTime } from "@/lib/utils";
import { CLINICAL_MODULES, MODULE_SERVICE_FALLBACKS, OPERATIONAL_MODULES, ADDON_SERVICES } from "@/lib/modules";
import { canAccessModule, canAccessModuleWorkflow, readAdminConfig } from "@/lib/admin/store";

export default async function ModulesPage() {
  const user = await requireSession();
  const adminConfig = await readAdminConfig();
  const moduleControls = adminConfig.modules;
  const visibleActiveModules = CLINICAL_MODULES.filter(
    (module) =>
      moduleControls.modules[module.key].enabled &&
      (!moduleControls.enforceRoleAccess || canAccessModule(adminConfig, user.role, module.key)),
  );

  let providers: Array<any> = [];
  let serviceTypes: Array<any> = MODULE_SERVICE_FALLBACKS;
  let appointments: Array<any> = [];
  let encounters: Array<any> = [];

  try {
    const [dbProviders, dbServiceTypes, dbAppointments, dbEncounters] = await Promise.all([
      db.user.findMany({ where: { active: true, role: "provider" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      db.serviceType.findMany({ where: { active: true, category: { in: visibleActiveModules.map((m) => m.key) } }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.appointment.findMany({
        where: { startsAt: { gte: new Date() } },
        include: { patient: true, provider: true, serviceType: true },
        orderBy: { startsAt: "asc" },
        take: 24,
      }),
      db.encounter.findMany({
        where: { status: { in: ["open", "signed"] } },
        include: { patient: true, provider: true },
        orderBy: { startedAt: "desc" },
        take: 24,
      }),
    ]);

    providers = dbProviders;
    serviceTypes = dbServiceTypes;
    appointments = dbAppointments;
    encounters = dbEncounters;
  } catch {
    // Keep modules operational with static service fallbacks when DB is unavailable.
  }

  return (
    <Shell user={user} pageTitle="Clinical Modules" jellyBeans={<JellyBeans />}>
      <div className="space-y-4">
        {!moduleControls.moduleHubEnabled && (
          <section className="card card-pad border-amber-200 bg-amber-50 text-amber-900">
            Module hub is currently disabled in Admin Operational Settings.
          </section>
        )}
        {moduleControls.enforceRoleAccess && (
          <section className="card card-pad border-blue-200 bg-blue-50 text-blue-900">
            Role enforcement is active. Module visibility and actions are filtered by your role permissions.
          </section>
        )}
        <section className="card card-pad">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200 font-semibold">Navigate sections</span>
            <Link href="#module-directory" className="chip bg-white text-slate-700 ring-slate-200 hover:bg-slate-50">Module Directory</Link>
            {moduleControls.showServiceOverview && <Link href="#service-overview" className="chip bg-white text-slate-700 ring-slate-200 hover:bg-slate-50">Service Overview</Link>}
            {moduleControls.showActivityStream && <Link href="#activity-stream" className="chip bg-white text-slate-700 ring-slate-200 hover:bg-slate-50">Activity Stream</Link>}
            <Link href="#operational-modules" className="chip bg-white text-slate-700 ring-slate-200 hover:bg-slate-50">Operational Modules</Link>
          </div>
        </section>

        <section id="operational-modules" className="space-y-3 scroll-mt-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {OPERATIONAL_MODULES.map((mod) => {
              const active = adminConfig.modules.integrations[mod.integrationFlag];
              return (
                <div key={mod.key} className="card overflow-hidden">
                  <header className={`px-4 py-4 border-b border-slate-200 ${mod.accent} bg-opacity-40`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operational</div>
                        <h3 className="text-lg font-bold text-slate-900">
                          <Link href={mod.href} className="hover:underline">{mod.title}</Link>
                        </h3>
                      </div>
                      <span className={`chip ${active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{active ? "active" : "paused"}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{mod.tagline}</p>
                  </header>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-slate-600">{mod.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.highlights.map((h) => <span key={h} className="chip bg-slate-100 text-slate-700 ring-slate-200">{h}</span>)}
                    </div>
                    <Link href={mod.href} className={`chip ${mod.accent} font-semibold hover:opacity-90`}>Open {mod.title}</Link>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="card overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Add-on services</header>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {ADDON_SERVICES.map((s) => (
                <div key={s.code} className="rounded-lg ring-1 ring-slate-200 p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{s.category}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.blurb}</div>
                </div>
              ))}
            </div>
          </section>
        </section>

        {moduleControls.showKpiCards && (
          <section className="card card-pad bg-gradient-to-br from-white to-slate-50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl space-y-2">
                <div className="chip bg-brand-100 text-brand-800 ring-brand-200 font-semibold">Hybrid clinic modules</div>
                <h2 className="text-2xl font-bold text-slate-900">Specialty landing zones for physical rehabilitation, wound care, and aesthetics</h2>
                <p className="text-sm text-slate-600">
                  These sections are provisioned with matching providers, service types, and seeded encounters so the clinic can work the way each specialty actually runs.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm min-w-[240px]">
                <Stat label="Providers" value={providers.length} />
                <Stat label="Services" value={serviceTypes.length} />
                <Stat label="Upcoming" value={appointments.length} />
                <Stat label="Open notes" value={encounters.filter(e => e.status === "open").length} />
              </div>
            </div>
          </section>
        )}

        <div id="module-directory" className="grid grid-cols-1 xl:grid-cols-3 gap-4 scroll-mt-32">
          {visibleActiveModules.map(module => {
            const runtime = moduleControls.modules[module.key];
            const moduleServices = serviceTypes.filter(service => service.category === module.key);
            const moduleAppointments = appointments.filter(appointment => appointment.serviceType?.category === module.key);
            const moduleEncounters = encounters.filter(encounter => encounter.provider?.specialty?.toLowerCase().includes(module.key === "physical-therapy" ? "physical therapy" : module.key === "wound-care" ? "wound care" : "aesthetic") || encounter.chiefComplaint?.toLowerCase().includes(module.key === "physical-therapy" ? "pt" : module.key === "wound-care" ? "wound" : "aesthetic"));
            const lead = providers.find(provider => provider.specialty?.toLowerCase().includes(module.key === "physical-therapy" ? "physical therapy" : module.key === "wound-care" ? "wound care" : "aesthetic"));
            const canSchedule = canAccessModuleWorkflow(adminConfig, user.role, module.key, "scheduling");
            const canChart = canAccessModuleWorkflow(adminConfig, user.role, module.key, "encounters");
            const canOrder = canAccessModuleWorkflow(adminConfig, user.role, module.key, "orders");
            const canBill = canAccessModuleWorkflow(adminConfig, user.role, module.key, "billing");
            const canTelehealth = canAccessModuleWorkflow(adminConfig, user.role, module.key, "telehealth") && adminConfig.modules.integrations.googleMeetTelehealth;

            return (
              <section key={module.key} className="card overflow-hidden">
                <header className={`px-4 py-4 border-b border-slate-200 ${colorForCategory(module.key)} bg-opacity-40`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Module</div>
                      <h3 className="text-lg font-bold text-slate-900">
                        <Link href={`/modules/${module.slug}`} className="hover:underline">
                          {module.title}
                        </Link>
                      </h3>
                    </div>
                    <span className={`chip ${colorForCategory(module.key)} font-semibold`}>{moduleServices.length} services</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{module.overview}</p>
                </header>

                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Provisioned lead</div>
                    <div className="font-semibold text-slate-900">{lead ? `${lead.firstName} ${lead.lastName}${lead.credential ? `, ${lead.credential}` : ""}` : module.lead}</div>
                    <div className="text-xs text-slate-500">{module.specialtyHint}</div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Service set</div>
                    <div className="flex flex-wrap gap-2">
                      {moduleServices.map(service => (
                        <span key={service.id} className="chip bg-slate-100 text-slate-700 ring-slate-200">
                          {service.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat label="Scheduled" value={moduleAppointments.length} />
                    <Stat label="Open notes" value={moduleEncounters.filter(e => e.status === "open").length} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className={`chip ${runtime.allowScheduling ? "bg-blue-100 text-blue-800 ring-blue-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Scheduling</span>
                    <span className={`chip ${runtime.allowEncounters ? "bg-blue-100 text-blue-800 ring-blue-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Encounters</span>
                    <span className={`chip ${runtime.allowOrders ? "bg-blue-100 text-blue-800 ring-blue-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Orders</span>
                    <span className={`chip ${runtime.allowBilling ? "bg-blue-100 text-blue-800 ring-blue-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Billing</span>
                    <span className={`chip ${runtime.allowTelehealth ? "bg-violet-100 text-violet-800 ring-violet-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Telehealth</span>
                  </div>

                  <div className="text-xs text-slate-500">Default visit {runtime.defaultVisitLengthMinutes} min · Max/day {runtime.maxDailyVisits} · Intake checklist {runtime.requireIntakeChecklist ? "required" : "optional"}</div>
                  <div className="text-xs text-slate-500">Staffing: {runtime.staffingTemplate} · Intake template: {runtime.intakeTemplate}</div>
                  <div className="text-xs text-slate-500">SLA: first response {runtime.slaFirstResponseMinutes} min · completion {runtime.slaCompletionHours} hr · reminders every {runtime.autoReminderHours} hr</div>
                  <div className="text-xs text-slate-500">Signoff role: {runtime.requiredRoleForSignoff} · Auto escalation: {runtime.autoEscalationEnabled ? "enabled" : "disabled"}</div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/modules/${module.slug}`} className="chip bg-brand-100 text-brand-800 ring-brand-200 hover:bg-brand-200">Open workspace</Link>
                    {canSchedule && <Link href="/schedule" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200">Schedule</Link>}
                    {canChart && <Link href="/encounters" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200">Encounters</Link>}
                    {canBill && <Link href="/billing" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200">Billing</Link>}
                    {canOrder && <Link href="/orders" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200">Orders</Link>}
                    {canTelehealth && <Link href="/schedule" className="chip bg-violet-100 text-violet-800 ring-violet-200 hover:bg-violet-200">Telehealth</Link>}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Operational focus</div>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {module.focus.map(item => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Common visit reasons</div>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {module.patientUse.map(item => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Next on deck</div>
                    {moduleAppointments[0] ? (
                      <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3 text-sm">
                        <div className="font-medium text-slate-900">
                          <Link href={`/patients/${moduleAppointments[0].patientId}`} className="hover:underline text-brand-700">
                            {moduleAppointments[0].patient.lastName}, {moduleAppointments[0].patient.firstName}
                          </Link>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {moduleAppointments[0].reason || moduleAppointments[0].serviceType?.name || "Visit"} · {fmtDateTime(moduleAppointments[0].startsAt)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">No upcoming module appointments.</div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
          {visibleActiveModules.length === 0 && (
            <section className="card card-pad border-amber-200 bg-amber-50 text-amber-900 xl:col-span-3">
              No modules are currently accessible for your role with active enforcement settings.
            </section>
          )}
        </div>

        {moduleControls.showServiceOverview && (
        <section id="service-overview" className="card scroll-mt-32">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Service overview by specialty</header>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {visibleActiveModules.map((module) => {
              const moduleServices = serviceTypes.filter((service) => service.category === module.key);
              return (
                <div key={module.key} className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3">
                  <div className={`chip ${colorForCategory(module.key)} font-semibold`}>{module.title}</div>
                  <div className="mt-2 text-sm text-slate-700">{moduleServices.length} configured service type(s)</div>
                  <div className="mt-2 text-xs text-slate-500">{moduleServices.slice(0, 3).map((service) => service.name).join(" / ") || "Using fallback service bundle"}</div>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {moduleControls.showActivityStream && (
        <section id="activity-stream" className="card scroll-mt-32">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Recent module activity</header>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {visibleActiveModules.map(module => {
              const latestEncounter = encounters.find(encounter => encounter.provider?.specialty?.toLowerCase().includes(module.key === "physical-therapy" ? "physical therapy" : module.key === "wound-care" ? "wound care" : "aesthetic"));
              const latestAppointment = appointments.find(appointment => appointment.serviceType?.category === module.key);

              return (
                <div key={module.key} className="p-4 space-y-3">
                  <div className={`chip ${colorForCategory(module.key)} font-semibold`}>{module.title}</div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Latest appointment</div>
                      <div className="text-slate-900 font-medium">{latestAppointment ? `${latestAppointment.patient.lastName}, ${latestAppointment.patient.firstName}` : "None"}</div>
                      <div className="text-xs text-slate-500">{latestAppointment ? fmtDateTime(latestAppointment.startsAt) : "No future visit queued"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Latest encounter</div>
                      <div className="text-slate-900 font-medium">{latestEncounter ? `${latestEncounter.patient.lastName}, ${latestEncounter.patient.firstName}` : "None"}</div>
                      <div className="text-xs text-slate-500">{latestEncounter?.chiefComplaint || latestEncounter?.status || "No note available"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}
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