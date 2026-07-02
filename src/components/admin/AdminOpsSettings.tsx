"use client";

import { useState } from "react";

type Org = {
  orgName: string;
  legalName: string;
  website: string;
  defaultTimezone: string;
  dateFormat: string;
  intakeMode: "digital-first" | "hybrid" | "in-person";
  allowSelfScheduling: boolean;
};

type Security = {
  mfaRequiredForAdmins: boolean;
  sessionTimeoutMinutes: number;
  passwordRotationDays: number;
  auditRetentionDays: number;
  bruteForceLockMinutes: number;
};

type Portal = {
  portalEnabled: boolean;
  allowDocumentDownload: boolean;
  allowDirectMessaging: boolean;
  allowOnlinePayments: boolean;
  showLabResultsAfterDays: number;
};

type ModuleKey = "physical-therapy" | "wound-care" | "aesthetic-medicine";

type ModuleFeature = {
  enabled: boolean;
  visibleInSidebar: boolean;
  allowScheduling: boolean;
  allowEncounters: boolean;
  allowOrders: boolean;
  allowBilling: boolean;
  allowPortalBooking: boolean;
  allowTelehealth: boolean;
  requireIntakeChecklist: boolean;
  defaultVisitLengthMinutes: number;
  maxDailyVisits: number;
  staffingTemplate: "solo-provider" | "provider-ma-team" | "provider-rn-team" | "full-hybrid-team";
  intakeTemplate: "standard" | "rehab" | "wound" | "aesthetic";
  slaFirstResponseMinutes: number;
  slaCompletionHours: number;
  autoEscalationEnabled: boolean;
  autoReminderHours: number;
  requiredRoleForSignoff: "provider" | "nurse";
};

type ModuleIntegrations = {
  labcorpOutbound: boolean;
  availityEligibility: boolean;
  pharmacyRouting: boolean;
  superbillAutomation: boolean;
  googleMeetTelehealth: boolean;
  claimScrubber: boolean;
  priorAuthTracking: boolean;
  pharmacyDispensing: boolean;
  posTerminal: boolean;
  inventoryManagement: boolean;
};

type Modules = {
  moduleHubEnabled: boolean;
  showKpiCards: boolean;
  showServiceOverview: boolean;
  showActivityStream: boolean;
  autoExpandModuleMenu: boolean;
  enforceRoleAccess: boolean;
  modules: Record<ModuleKey, ModuleFeature>;
  integrations: ModuleIntegrations;
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  "physical-therapy": "Physical Therapy",
  "wound-care": "Wound Care",
  "aesthetic-medicine": "Aesthetics",
};

export default function AdminOpsSettings({
  initialOrg,
  initialSecurity,
  initialPortal,
  initialModules,
}: {
  initialOrg: Org;
  initialSecurity: Security;
  initialPortal: Portal;
  initialModules: Modules;
}) {
  const [org, setOrg] = useState(initialOrg);
  const [security, setSecurity] = useState(initialSecurity);
  const [portal, setPortal] = useState(initialPortal);
  const [modules, setModules] = useState(initialModules);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveSection(section: "org" | "security" | "portal" | "modules", data: unknown) {
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section, data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not save settings");
    return json.config;
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    try {
      const first = await saveSection("org", org);
      setOrg(first.org);
      const second = await saveSection("security", security);
      setSecurity(second.security);
      const third = await saveSection("portal", portal);
      setPortal(third.portal);
      const fourth = await saveSection("modules", modules);
      setModules(fourth.modules);
      setMessage("Operational settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateModule(moduleKey: ModuleKey, patch: Partial<ModuleFeature>) {
    setModules((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: {
          ...prev.modules[moduleKey],
          ...patch,
        },
      },
    }));
  }

  return (
    <section className="space-y-4">
      <div className="card card-pad space-y-3">
        <h2 className="font-semibold">Organization Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input" placeholder="Organization name" value={org.orgName} onChange={(e) => setOrg((v) => ({ ...v, orgName: e.target.value }))} />
          <input className="input" placeholder="Legal name" value={org.legalName} onChange={(e) => setOrg((v) => ({ ...v, legalName: e.target.value }))} />
          <input className="input" placeholder="Website" value={org.website} onChange={(e) => setOrg((v) => ({ ...v, website: e.target.value }))} />
          <input className="input" placeholder="Timezone" value={org.defaultTimezone} onChange={(e) => setOrg((v) => ({ ...v, defaultTimezone: e.target.value }))} />
          <input className="input" placeholder="Date format" value={org.dateFormat} onChange={(e) => setOrg((v) => ({ ...v, dateFormat: e.target.value }))} />
          <select className="input" value={org.intakeMode} onChange={(e) => setOrg((v) => ({ ...v, intakeMode: e.target.value as Org["intakeMode"] }))}>
            <option value="digital-first">digital-first</option>
            <option value="hybrid">hybrid</option>
            <option value="in-person">in-person</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={org.allowSelfScheduling} onChange={(e) => setOrg((v) => ({ ...v, allowSelfScheduling: e.target.checked }))} />
          Allow patient self-scheduling
        </label>
      </div>

      <div className="card card-pad space-y-3">
        <h2 className="font-semibold">Security and Compliance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs">Session timeout (minutes)
            <input type="number" className="input" value={security.sessionTimeoutMinutes} onChange={(e) => setSecurity((v) => ({ ...v, sessionTimeoutMinutes: Number(e.target.value || 0) }))} />
          </label>
          <label className="text-xs">Password rotation (days)
            <input type="number" className="input" value={security.passwordRotationDays} onChange={(e) => setSecurity((v) => ({ ...v, passwordRotationDays: Number(e.target.value || 0) }))} />
          </label>
          <label className="text-xs">Audit retention (days)
            <input type="number" className="input" value={security.auditRetentionDays} onChange={(e) => setSecurity((v) => ({ ...v, auditRetentionDays: Number(e.target.value || 0) }))} />
          </label>
          <label className="text-xs">Lockout window (minutes)
            <input type="number" className="input" value={security.bruteForceLockMinutes} onChange={(e) => setSecurity((v) => ({ ...v, bruteForceLockMinutes: Number(e.target.value || 0) }))} />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={security.mfaRequiredForAdmins} onChange={(e) => setSecurity((v) => ({ ...v, mfaRequiredForAdmins: e.target.checked }))} />
          Require MFA for admin users
        </label>
      </div>

      <div className="card card-pad space-y-3">
        <h2 className="font-semibold">Patient Portal Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={portal.portalEnabled} onChange={(e) => setPortal((v) => ({ ...v, portalEnabled: e.target.checked }))} /> Portal enabled</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={portal.allowDocumentDownload} onChange={(e) => setPortal((v) => ({ ...v, allowDocumentDownload: e.target.checked }))} /> Allow downloads</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={portal.allowDirectMessaging} onChange={(e) => setPortal((v) => ({ ...v, allowDirectMessaging: e.target.checked }))} /> Allow messaging</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={portal.allowOnlinePayments} onChange={(e) => setPortal((v) => ({ ...v, allowOnlinePayments: e.target.checked }))} /> Allow online payments</label>
          <label className="text-xs">Lab release delay (days)
            <input type="number" className="input" value={portal.showLabResultsAfterDays} onChange={(e) => setPortal((v) => ({ ...v, showLabResultsAfterDays: Number(e.target.value || 0) }))} />
          </label>
        </div>
      </div>

      <div className="card card-pad space-y-3">
        <h2 className="font-semibold">Module Runtime Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.moduleHubEnabled} onChange={(e) => setModules((v) => ({ ...v, moduleHubEnabled: e.target.checked }))} /> Enable module hub</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.showKpiCards} onChange={(e) => setModules((v) => ({ ...v, showKpiCards: e.target.checked }))} /> Show KPI cards</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.showServiceOverview} onChange={(e) => setModules((v) => ({ ...v, showServiceOverview: e.target.checked }))} /> Show service overview</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.showActivityStream} onChange={(e) => setModules((v) => ({ ...v, showActivityStream: e.target.checked }))} /> Show activity stream</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.autoExpandModuleMenu} onChange={(e) => setModules((v) => ({ ...v, autoExpandModuleMenu: e.target.checked }))} /> Auto-expand module menu</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.enforceRoleAccess} onChange={(e) => setModules((v) => ({ ...v, enforceRoleAccess: e.target.checked }))} /> Enforce role-based module access</label>
        </div>
      </div>

      <div className="space-y-3">
        {(Object.keys(modules.modules) as ModuleKey[]).map((moduleKey) => {
          const mod = modules.modules[moduleKey];
          return (
            <div key={moduleKey} className="card card-pad space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{MODULE_LABELS[moduleKey]} Module</h3>
                <span className={`chip ${mod.enabled ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}`}>{mod.enabled ? "active" : "inactive"}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.enabled} onChange={(e) => updateModule(moduleKey, { enabled: e.target.checked })} /> Enable module</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.visibleInSidebar} onChange={(e) => updateModule(moduleKey, { visibleInSidebar: e.target.checked })} /> Show in sidebar</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.allowPortalBooking} onChange={(e) => updateModule(moduleKey, { allowPortalBooking: e.target.checked })} /> Allow portal booking</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.allowScheduling} onChange={(e) => updateModule(moduleKey, { allowScheduling: e.target.checked })} /> Enable scheduling</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.allowEncounters} onChange={(e) => updateModule(moduleKey, { allowEncounters: e.target.checked })} /> Enable encounters</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.allowOrders} onChange={(e) => updateModule(moduleKey, { allowOrders: e.target.checked })} /> Enable orders</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.allowBilling} onChange={(e) => updateModule(moduleKey, { allowBilling: e.target.checked })} /> Enable billing</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.allowTelehealth} onChange={(e) => updateModule(moduleKey, { allowTelehealth: e.target.checked })} /> Enable telehealth workflows</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.requireIntakeChecklist} onChange={(e) => updateModule(moduleKey, { requireIntakeChecklist: e.target.checked })} /> Require intake checklist</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs">Default visit length (minutes)
                  <input type="number" className="input" value={mod.defaultVisitLengthMinutes} onChange={(e) => updateModule(moduleKey, { defaultVisitLengthMinutes: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs">Max daily visits
                  <input type="number" className="input" value={mod.maxDailyVisits} onChange={(e) => updateModule(moduleKey, { maxDailyVisits: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs">Staffing template
                  <select className="input" value={mod.staffingTemplate} onChange={(e) => updateModule(moduleKey, { staffingTemplate: e.target.value as ModuleFeature["staffingTemplate"] })}>
                    <option value="solo-provider">solo-provider</option>
                    <option value="provider-ma-team">provider-ma-team</option>
                    <option value="provider-rn-team">provider-rn-team</option>
                    <option value="full-hybrid-team">full-hybrid-team</option>
                  </select>
                </label>
                <label className="text-xs">Intake template
                  <select className="input" value={mod.intakeTemplate} onChange={(e) => updateModule(moduleKey, { intakeTemplate: e.target.value as ModuleFeature["intakeTemplate"] })}>
                    <option value="standard">standard</option>
                    <option value="rehab">rehab</option>
                    <option value="wound">wound</option>
                    <option value="aesthetic">aesthetic</option>
                  </select>
                </label>
                <label className="text-xs">SLA first response (minutes)
                  <input type="number" className="input" value={mod.slaFirstResponseMinutes} onChange={(e) => updateModule(moduleKey, { slaFirstResponseMinutes: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs">SLA completion (hours)
                  <input type="number" className="input" value={mod.slaCompletionHours} onChange={(e) => updateModule(moduleKey, { slaCompletionHours: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs">Auto reminder cadence (hours)
                  <input type="number" className="input" value={mod.autoReminderHours} onChange={(e) => updateModule(moduleKey, { autoReminderHours: Number(e.target.value || 0) })} />
                </label>
                <label className="text-xs">Required signoff role
                  <select className="input" value={mod.requiredRoleForSignoff} onChange={(e) => updateModule(moduleKey, { requiredRoleForSignoff: e.target.value as ModuleFeature["requiredRoleForSignoff"] })}>
                    <option value="provider">provider</option>
                    <option value="nurse">nurse</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={mod.autoEscalationEnabled} onChange={(e) => updateModule(moduleKey, { autoEscalationEnabled: e.target.checked })} /> Enable SLA auto-escalation</label>
                <div className="text-xs text-slate-500">Escalations trigger when response/completion SLA thresholds are exceeded.</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card card-pad space-y-3">
        <h2 className="font-semibold">Integration Feature Flags</h2>
        <p className="text-xs text-slate-500">Toggle whether each integration influences module workflows. Vendor selection, credentials, and connection testing are configured in External Integrations and Automation below.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.labcorpOutbound} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, labcorpOutbound: e.target.checked } }))} /> Labcorp outbound routing</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.availityEligibility} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, availityEligibility: e.target.checked } }))} /> Availity eligibility checks</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.pharmacyRouting} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, pharmacyRouting: e.target.checked } }))} /> Pharmacy e-prescribe routing (Surescripts / Availity)</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.superbillAutomation} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, superbillAutomation: e.target.checked } }))} /> Superbill automation</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.googleMeetTelehealth} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, googleMeetTelehealth: e.target.checked } }))} /> Google Meet telehealth links</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.claimScrubber} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, claimScrubber: e.target.checked } }))} /> Claim scrubber pre-submit checks</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.priorAuthTracking} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, priorAuthTracking: e.target.checked } }))} /> Prior authorization tracking</label>
        </div>
      </div>

      <div className="card card-pad space-y-3">
        <h2 className="font-semibold">Operational Modules</h2>
        <p className="text-xs text-slate-500">Pharmacy, point of sale, and inventory are visible to every user for now. Use these switches to activate or pause each workspace; granular role control arrives later.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.pharmacyDispensing} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, pharmacyDispensing: e.target.checked } }))} /> Pharmacy dispensing workspace</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.posTerminal} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, posTerminal: e.target.checked } }))} /> Point-of-sale terminal</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={modules.integrations.inventoryManagement} onChange={(e) => setModules((v) => ({ ...v, integrations: { ...v.integrations, inventoryManagement: e.target.checked } }))} /> Inventory management</label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button className="btn-primary" onClick={saveAll} disabled={saving}>{saving ? "Saving..." : "Save All Operational Settings"}</button>
      </div>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </section>
  );
}
