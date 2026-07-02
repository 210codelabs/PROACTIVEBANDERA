import fs from "node:fs/promises";
import path from "node:path";
import type { ClinicalModuleKey } from "@/lib/modules";

export type StaffRole = "provider" | "nurse" | "frontdesk" | "billing" | "admin";

export type RolePermissionSet = {
  dashboard: boolean;
  scheduling: boolean;
  patientsRead: boolean;
  patientsWrite: boolean;
  encountersWrite: boolean;
  ordersWrite: boolean;
  billingRead: boolean;
  billingWrite: boolean;
  messaging: boolean;
  adminAccess: boolean;
};

export type BrandingConfig = {
  appName: string;
  slogan: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
};

export type LandingConfig = {
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  featureCards: Array<{ title: string; description: string }>;
};

export type OrgConfig = {
  orgName: string;
  legalName: string;
  website: string;
  defaultTimezone: string;
  dateFormat: string;
  intakeMode: "digital-first" | "hybrid" | "in-person";
  allowSelfScheduling: boolean;
};

export type SecurityConfig = {
  mfaRequiredForAdmins: boolean;
  sessionTimeoutMinutes: number;
  passwordRotationDays: number;
  auditRetentionDays: number;
  bruteForceLockMinutes: number;
};

export type PortalConfig = {
  portalEnabled: boolean;
  allowDocumentDownload: boolean;
  allowDirectMessaging: boolean;
  allowOnlinePayments: boolean;
  showLabResultsAfterDays: number;
};

export type ModuleFeatureConfig = {
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

export type ModuleIntegrationsConfig = {
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

export type ModulesConfig = {
  moduleHubEnabled: boolean;
  showKpiCards: boolean;
  showServiceOverview: boolean;
  showActivityStream: boolean;
  autoExpandModuleMenu: boolean;
  enforceRoleAccess: boolean;
  modules: Record<ClinicalModuleKey, ModuleFeatureConfig>;
  integrations: ModuleIntegrationsConfig;
};

export type AdminConfig = {
  branding: BrandingConfig;
  landing: LandingConfig;
  org: OrgConfig;
  security: SecurityConfig;
  portal: PortalConfig;
  modules: ModulesConfig;
  roles: Record<StaffRole, RolePermissionSet>;
};

const DEFAULTS: AdminConfig = {
  branding: {
    appName: "ProactiveClinics",
    slogan: "State-of-the-art clinical and aesthetic care at Bandera Rd",
    logoUrl: "/powered-by-proactiveums-attached.png",
    primaryColor: "#3a86c8",
    secondaryColor: "#0b1e35",
    accentColor: "#c51f1f",
    supportEmail: "support@proactivemedical.com",
    supportPhone: "+1 (210) 555-0148",
  },
  landing: {
    heroTitle: "Modern Care, Human First.",
    heroSubtitle:
      "A complete care experience with integrated scheduling, messaging, documentation, and patient self-service.",
    ctaPrimaryLabel: "Patient Portal",
    ctaPrimaryHref: "/portal/login",
    ctaSecondaryLabel: "Staff Login",
    ctaSecondaryHref: "/login",
    featureCards: [
      { title: "Care Anywhere", description: "In-office, home, and telehealth workflows in one platform." },
      { title: "Live Clinical Ops", description: "Real-time dashboards for encounters, orders, and patient throughput." },
      { title: "Patient Self-Service", description: "Patients can view visits, documents, and send secure messages." },
    ],
  },
  org: {
    orgName: "Proactive Medical Clinic",
    legalName: "Proactive Medical Services, Inc.",
    website: "https://www.proactivemedical.com",
    defaultTimezone: "America/Chicago",
    dateFormat: "MM/dd/yyyy",
    intakeMode: "hybrid",
    allowSelfScheduling: true,
  },
  security: {
    mfaRequiredForAdmins: true,
    sessionTimeoutMinutes: 60,
    passwordRotationDays: 90,
    auditRetentionDays: 365,
    bruteForceLockMinutes: 15,
  },
  portal: {
    portalEnabled: true,
    allowDocumentDownload: true,
    allowDirectMessaging: true,
    allowOnlinePayments: false,
    showLabResultsAfterDays: 2,
  },
  modules: {
    moduleHubEnabled: true,
    showKpiCards: true,
    showServiceOverview: true,
    showActivityStream: true,
    autoExpandModuleMenu: true,
    enforceRoleAccess: false,
    modules: {
      "physical-therapy": {
        enabled: true,
        visibleInSidebar: true,
        allowScheduling: true,
        allowEncounters: true,
        allowOrders: true,
        allowBilling: true,
        allowPortalBooking: true,
        allowTelehealth: true,
        requireIntakeChecklist: true,
        defaultVisitLengthMinutes: 45,
        maxDailyVisits: 28,
        staffingTemplate: "provider-rn-team",
        intakeTemplate: "rehab",
        slaFirstResponseMinutes: 45,
        slaCompletionHours: 72,
        autoEscalationEnabled: true,
        autoReminderHours: 12,
        requiredRoleForSignoff: "provider",
      },
      "wound-care": {
        enabled: true,
        visibleInSidebar: true,
        allowScheduling: true,
        allowEncounters: true,
        allowOrders: true,
        allowBilling: true,
        allowPortalBooking: false,
        allowTelehealth: true,
        requireIntakeChecklist: true,
        defaultVisitLengthMinutes: 40,
        maxDailyVisits: 22,
        staffingTemplate: "provider-rn-team",
        intakeTemplate: "wound",
        slaFirstResponseMinutes: 30,
        slaCompletionHours: 48,
        autoEscalationEnabled: true,
        autoReminderHours: 8,
        requiredRoleForSignoff: "provider",
      },
      "aesthetic-medicine": {
        enabled: true,
        visibleInSidebar: true,
        allowScheduling: true,
        allowEncounters: true,
        allowOrders: true,
        allowBilling: true,
        allowPortalBooking: true,
        allowTelehealth: true,
        requireIntakeChecklist: false,
        defaultVisitLengthMinutes: 30,
        maxDailyVisits: 36,
        staffingTemplate: "provider-ma-team",
        intakeTemplate: "aesthetic",
        slaFirstResponseMinutes: 60,
        slaCompletionHours: 96,
        autoEscalationEnabled: true,
        autoReminderHours: 24,
        requiredRoleForSignoff: "nurse",
      },
    },
    integrations: {
      labcorpOutbound: true,
      availityEligibility: true,
      pharmacyRouting: true,
      superbillAutomation: true,
      googleMeetTelehealth: true,
      claimScrubber: true,
      priorAuthTracking: true,
      pharmacyDispensing: true,
      posTerminal: true,
      inventoryManagement: true,
    },
  },
  roles: {
    provider: {
      dashboard: true,
      scheduling: true,
      patientsRead: true,
      patientsWrite: true,
      encountersWrite: true,
      ordersWrite: true,
      billingRead: true,
      billingWrite: false,
      messaging: true,
      adminAccess: false,
    },
    nurse: {
      dashboard: true,
      scheduling: true,
      patientsRead: true,
      patientsWrite: true,
      encountersWrite: true,
      ordersWrite: false,
      billingRead: false,
      billingWrite: false,
      messaging: true,
      adminAccess: false,
    },
    frontdesk: {
      dashboard: true,
      scheduling: true,
      patientsRead: true,
      patientsWrite: true,
      encountersWrite: false,
      ordersWrite: false,
      billingRead: true,
      billingWrite: false,
      messaging: true,
      adminAccess: false,
    },
    billing: {
      dashboard: true,
      scheduling: false,
      patientsRead: true,
      patientsWrite: false,
      encountersWrite: false,
      ordersWrite: false,
      billingRead: true,
      billingWrite: true,
      messaging: true,
      adminAccess: false,
    },
    admin: {
      dashboard: true,
      scheduling: true,
      patientsRead: true,
      patientsWrite: true,
      encountersWrite: true,
      ordersWrite: true,
      billingRead: true,
      billingWrite: true,
      messaging: true,
      adminAccess: true,
    },
  },
};

const ADMIN_CONFIG_PATH = path.join(process.cwd(), "lfs", "tmp", "admin-console.json");

async function ensureConfigDir() {
  const dir = path.dirname(ADMIN_CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
}

export async function readAdminConfig(): Promise<AdminConfig> {
  try {
    const raw = await fs.readFile(ADMIN_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AdminConfig>;
    return {
      ...DEFAULTS,
      ...parsed,
      branding: { ...DEFAULTS.branding, ...(parsed.branding ?? {}) },
      landing: { ...DEFAULTS.landing, ...(parsed.landing ?? {}) },
      org: { ...DEFAULTS.org, ...(parsed.org ?? {}) },
      security: { ...DEFAULTS.security, ...(parsed.security ?? {}) },
      portal: { ...DEFAULTS.portal, ...(parsed.portal ?? {}) },
      modules: {
        ...DEFAULTS.modules,
        ...(parsed.modules ?? {}),
        modules: {
          ...DEFAULTS.modules.modules,
          ...(parsed.modules?.modules ?? {}),
          "physical-therapy": {
            ...DEFAULTS.modules.modules["physical-therapy"],
            ...(parsed.modules?.modules?.["physical-therapy"] ?? {}),
          },
          "wound-care": {
            ...DEFAULTS.modules.modules["wound-care"],
            ...(parsed.modules?.modules?.["wound-care"] ?? {}),
          },
          "aesthetic-medicine": {
            ...DEFAULTS.modules.modules["aesthetic-medicine"],
            ...(parsed.modules?.modules?.["aesthetic-medicine"] ?? {}),
          },
        },
        integrations: {
          ...DEFAULTS.modules.integrations,
          ...(parsed.modules?.integrations ?? {}),
        },
      },
      roles: {
        ...DEFAULTS.roles,
        ...(parsed.roles ?? {}),
      },
    };
  } catch {
    return DEFAULTS;
  }
}

export async function writeAdminConfig(nextConfig: AdminConfig): Promise<AdminConfig> {
  await ensureConfigDir();
  await fs.writeFile(ADMIN_CONFIG_PATH, JSON.stringify(nextConfig, null, 2), "utf8");
  return nextConfig;
}

export async function patchAdminConfig<K extends keyof AdminConfig>(section: K, value: AdminConfig[K]) {
  const current = await readAdminConfig();
  const next: AdminConfig = {
    ...current,
    [section]: value,
  };
  return await writeAdminConfig(next);
}

export function canRoleAccess(config: AdminConfig, role: StaffRole, permission: keyof RolePermissionSet) {
  return !!config.roles[role]?.[permission];
}

export function canAccessModule(config: AdminConfig, role: StaffRole, moduleKey: ClinicalModuleKey) {
  const moduleConfig = config.modules.modules[moduleKey];
  if (!moduleConfig.enabled) return false;
  if (!config.modules.enforceRoleAccess) return true;
  return canRoleAccess(config, role, "patientsRead") && canRoleAccess(config, role, "dashboard");
}

export function canAccessModuleWorkflow(
  config: AdminConfig,
  role: StaffRole,
  moduleKey: ClinicalModuleKey,
  workflow: "scheduling" | "encounters" | "orders" | "billing" | "telehealth",
) {
  const moduleConfig = config.modules.modules[moduleKey];
  if (!canAccessModule(config, role, moduleKey)) return false;

  if (workflow === "scheduling") {
    return moduleConfig.allowScheduling && canRoleAccess(config, role, "scheduling");
  }
  if (workflow === "encounters") {
    return moduleConfig.allowEncounters && canRoleAccess(config, role, "encountersWrite");
  }
  if (workflow === "orders") {
    return moduleConfig.allowOrders && canRoleAccess(config, role, "ordersWrite");
  }
  if (workflow === "billing") {
    return moduleConfig.allowBilling && canRoleAccess(config, role, "billingRead");
  }
  return moduleConfig.allowTelehealth && canRoleAccess(config, role, "scheduling");
}
