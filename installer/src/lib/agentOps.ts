import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";
import type { StaffRole } from "@/lib/admin/store";

export type AgentKey =
  | "coding-billing"
  | "medical-notes"
  | "validation"
  | "data-correction"
  | "flow-optimizer";

export type RunMode = "scan" | "autofix" | "autonomous";

export type AgentDefinition = {
  key: AgentKey;
  name: string;
  purpose: string;
  scope: string[];
};

export type AgentFinding = {
  agent: AgentKey;
  severity: "high" | "medium" | "low";
  entityType: "encounter" | "patient" | "order" | "system";
  entityId: string;
  title: string;
  detail: string;
  recommendation: string;
  fixed: boolean;
};

export type AgentRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  mode: RunMode;
  triggeredBy: string;
  findings: AgentFinding[];
  metrics: {
    totalFindings: number;
    fixedCount: number;
    bySeverity: Record<"high" | "medium" | "low", number>;
    byAgent: Record<AgentKey, number>;
  };
};

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    key: "coding-billing",
    name: "Coding and Billing Agent",
    purpose: "Validates diagnosis/charge completeness and coding quality for revenue integrity.",
    scope: ["ICD-10 primary assignment", "CPT quality", "signed encounter billing readiness"],
  },
  {
    key: "medical-notes",
    name: "Medical Notes Agent",
    purpose: "Audits SOAP quality and note completion for clinical documentation integrity.",
    scope: ["SOAP completeness", "chief complaint quality", "note normalization"],
  },
  {
    key: "validation",
    name: "Validation Agent",
    purpose: "Validates demographic and contact fields and flags integrity issues.",
    scope: ["DOB checks", "email/phone format", "required demographic fields"],
  },
  {
    key: "data-correction",
    name: "Data Correction Agent",
    purpose: "Auto-corrects common data-entry defects and normalizes clinical records.",
    scope: ["trim/normalize values", "ICD formatting", "insurance data consistency"],
  },
  {
    key: "flow-optimizer",
    name: "Flow and Order Optimizer Agent",
    purpose: "Tracks bottlenecks and optimizes order throughput and routing.",
    scope: ["pending order aging", "Labcorp outbound flow", "queue pressure signals"],
  },
];

const RUN_STORE_PATHS = [
  path.join(process.cwd(), "lfs", "tmp", "agent-runs.json"),
  path.join(os.tmpdir(), "proactive-agent-runs.json"),
];
const MAX_STORED_RUNS = 50;

function nowIso() {
  return new Date().toISOString();
}

function makeRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readRuns(): Promise<AgentRun[]> {
  for (const storePath of RUN_STORE_PATHS) {
    try {
      const raw = await fs.readFile(storePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next candidate store path.
    }
  }

  return [];
}

async function writeRuns(runs: AgentRun[]) {
  const payload = JSON.stringify(runs.slice(0, MAX_STORED_RUNS), null, 2);
  for (const storePath of RUN_STORE_PATHS) {
    try {
      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, payload, "utf8");
      return;
    } catch {
      // Try the next candidate store path.
    }
  }
}

function normalizeSpaces(value: string | null | undefined) {
  if (!value) return value ?? null;
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return value ?? null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function isLikelyValidEmail(value: string | null | undefined) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function summarize(findings: AgentFinding[]) {
  const bySeverity = { high: 0, medium: 0, low: 0 } as Record<"high" | "medium" | "low", number>;
  const byAgent = {
    "coding-billing": 0,
    "medical-notes": 0,
    validation: 0,
    "data-correction": 0,
    "flow-optimizer": 0,
  } as Record<AgentKey, number>;

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byAgent[finding.agent] += 1;
  }

  return {
    totalFindings: findings.length,
    fixedCount: findings.filter((f) => f.fixed).length,
    bySeverity,
    byAgent,
  };
}

async function codingBillingAgent(autofix: boolean): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];
  const encounters = await db.encounter.findMany({
    where: { status: { in: ["open", "signed"] } },
    include: { diagnoses: true, charges: true },
    orderBy: { startedAt: "desc" },
    take: 250,
  });

  for (const encounter of encounters) {
    if (encounter.status === "signed" && encounter.diagnoses.length === 0) {
      findings.push({
        agent: "coding-billing",
        severity: "high",
        entityType: "encounter",
        entityId: encounter.id,
        title: "Signed encounter missing diagnosis",
        detail: "Encounter is signed but has no ICD-10 diagnosis assigned.",
        recommendation: "Add at least one primary diagnosis before claim submission.",
        fixed: false,
      });
    }

    if (encounter.status === "signed" && encounter.charges.length === 0) {
      findings.push({
        agent: "coding-billing",
        severity: "high",
        entityType: "encounter",
        entityId: encounter.id,
        title: "Signed encounter missing charges",
        detail: "Encounter is signed but has no billable charges.",
        recommendation: "Attach CPT charges prior to sending superbill/claim.",
        fixed: false,
      });
    }

    if (encounter.diagnoses.length > 0 && !encounter.diagnoses.some((d) => d.primary)) {
      let fixed = false;
      if (autofix) {
        const primary = encounter.diagnoses[0];
        await db.encounterDiagnosis.update({ where: { id: primary.id }, data: { primary: true } });
        fixed = true;
      }
      findings.push({
        agent: "coding-billing",
        severity: "medium",
        entityType: "encounter",
        entityId: encounter.id,
        title: "No primary diagnosis flagged",
        detail: "Diagnoses exist but none are marked as primary.",
        recommendation: "Mark one diagnosis as primary for clean claim routing.",
        fixed,
      });
    }

    for (const charge of encounter.charges) {
      if (charge.units <= 0 || charge.feeCents < 0) {
        let fixed = false;
        if (autofix) {
          await db.encounterCharge.update({
            where: { id: charge.id },
            data: {
              units: charge.units <= 0 ? 1 : charge.units,
              feeCents: Math.abs(charge.feeCents),
            },
          });
          fixed = true;
        }
        findings.push({
          agent: "coding-billing",
          severity: "high",
          entityType: "encounter",
          entityId: encounter.id,
          title: "Invalid charge amount or units",
          detail: `Charge ${charge.cpt} has units=${charge.units} feeCents=${charge.feeCents}.`,
          recommendation: "Normalize units to >=1 and fee to non-negative values.",
          fixed,
        });
      }
    }
  }

  return findings;
}

async function medicalNotesAgent(autofix: boolean): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];
  const encounters = await db.encounter.findMany({
    where: { status: { in: ["open", "signed"] } },
    orderBy: { startedAt: "desc" },
    take: 250,
  });

  for (const encounter of encounters) {
    const missingSoap = [
      ["subjective", encounter.subjective],
      ["objective", encounter.objective],
      ["assessment", encounter.assessment],
      ["plan", encounter.plan],
    ].filter(([, value]) => !value || !String(value).trim());

    if (encounter.status === "signed" && missingSoap.length > 0) {
      findings.push({
        agent: "medical-notes",
        severity: "medium",
        entityType: "encounter",
        entityId: encounter.id,
        title: "Signed note missing SOAP sections",
        detail: `Missing sections: ${missingSoap.map(([k]) => k).join(", ")}.`,
        recommendation: "Complete SOAP sections for compliant documentation.",
        fixed: false,
      });
    }

    const normalized = {
      chiefComplaint: normalizeSpaces(encounter.chiefComplaint),
      subjective: normalizeSpaces(encounter.subjective),
      objective: normalizeSpaces(encounter.objective),
      assessment: normalizeSpaces(encounter.assessment),
      plan: normalizeSpaces(encounter.plan),
      ros: normalizeSpaces(encounter.ros),
      examFindings: normalizeSpaces(encounter.examFindings),
    };

    const changed =
      normalized.chiefComplaint !== encounter.chiefComplaint ||
      normalized.subjective !== encounter.subjective ||
      normalized.objective !== encounter.objective ||
      normalized.assessment !== encounter.assessment ||
      normalized.plan !== encounter.plan ||
      normalized.ros !== encounter.ros ||
      normalized.examFindings !== encounter.examFindings;

    if (changed) {
      let fixed = false;
      if (autofix) {
        await db.encounter.update({ where: { id: encounter.id }, data: normalized });
        fixed = true;
      }
      findings.push({
        agent: "medical-notes",
        severity: "low",
        entityType: "encounter",
        entityId: encounter.id,
        title: "Note normalization recommended",
        detail: "Whitespace and formatting inconsistencies detected in note fields.",
        recommendation: "Normalize spacing and text formatting in SOAP fields.",
        fixed,
      });
    }
  }

  return findings;
}

async function validationAgent(autofix: boolean): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];
  const patients = await db.patient.findMany({ orderBy: { updatedAt: "desc" }, take: 300 });

  for (const patient of patients) {
    if (patient.dob > new Date()) {
      findings.push({
        agent: "validation",
        severity: "high",
        entityType: "patient",
        entityId: patient.id,
        title: "Invalid DOB",
        detail: "Date of birth is set in the future.",
        recommendation: "Correct DOB to a valid historical date.",
        fixed: false,
      });
    }

    if (!isLikelyValidEmail(patient.email)) {
      findings.push({
        agent: "validation",
        severity: "medium",
        entityType: "patient",
        entityId: patient.id,
        title: "Invalid email format",
        detail: `Email \"${patient.email}\" appears malformed.`,
        recommendation: "Correct the email format for communication workflows.",
        fixed: false,
      });
    }

    const normalizedPhone = normalizePhone(patient.phone);
    const normalizedFirst = normalizeSpaces(patient.firstName);
    const normalizedLast = normalizeSpaces(patient.lastName);
    const normalizedEmail = patient.email ? patient.email.trim().toLowerCase() : patient.email;

    const changed =
      normalizedPhone !== patient.phone ||
      normalizedFirst !== patient.firstName ||
      normalizedLast !== patient.lastName ||
      normalizedEmail !== patient.email;

    if (changed) {
      let fixed = false;
      if (autofix) {
        await db.patient.update({
          where: { id: patient.id },
          data: {
            phone: normalizedPhone,
            firstName: normalizedFirst || patient.firstName,
            lastName: normalizedLast || patient.lastName,
            email: normalizedEmail,
          },
        });
        fixed = true;
      }

      findings.push({
        agent: "validation",
        severity: "low",
        entityType: "patient",
        entityId: patient.id,
        title: "Patient demographic normalization",
        detail: "Name/contact fields can be normalized for consistency.",
        recommendation: "Apply normalized formatting for name, email, and phone.",
        fixed,
      });
    }
  }

  return findings;
}

async function dataCorrectionAgent(autofix: boolean): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  const diagnoses = await db.encounterDiagnosis.findMany({ take: 300, orderBy: { createdAt: "desc" } });
  for (const d of diagnoses) {
    if (d.icd10 !== d.icd10.toUpperCase()) {
      let fixed = false;
      if (autofix) {
        await db.encounterDiagnosis.update({ where: { id: d.id }, data: { icd10: d.icd10.toUpperCase() } });
        fixed = true;
      }
      findings.push({
        agent: "data-correction",
        severity: "low",
        entityType: "encounter",
        entityId: d.encounterId,
        title: "ICD-10 casing normalization",
        detail: `Diagnosis code ${d.icd10} is not uppercase.`,
        recommendation: "Store ICD-10 in uppercase for consistency.",
        fixed,
      });
    }
  }

  const orders = await db.order.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  for (const order of orders) {
    const normalizedName = normalizeSpaces(order.itemName);
    if (normalizedName !== order.itemName) {
      let fixed = false;
      if (autofix && normalizedName) {
        await db.order.update({ where: { id: order.id }, data: { itemName: normalizedName } });
        fixed = true;
      }
      findings.push({
        agent: "data-correction",
        severity: "low",
        entityType: "order",
        entityId: order.id,
        title: "Order item text normalization",
        detail: "Order item name has inconsistent spacing/format.",
        recommendation: "Normalize item labels to clean search/indexing.",
        fixed,
      });
    }

    if (!order.itemName.trim()) {
      findings.push({
        agent: "data-correction",
        severity: "high",
        entityType: "order",
        entityId: order.id,
        title: "Order missing item name",
        detail: "Order item name is empty.",
        recommendation: "Populate order item before routing.",
        fixed: false,
      });
    }
  }

  return findings;
}

async function flowOptimizerAgent(autofix: boolean): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];
  const adminConfig = await readAdminConfig();
  const now = Date.now();

  const pendingOrders = await db.order.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 400 });

  for (const order of pendingOrders) {
    const ageHours = (now - new Date(order.createdAt).getTime()) / 1000 / 60 / 60;
    if (ageHours > 48) {
      findings.push({
        agent: "flow-optimizer",
        severity: "medium",
        entityType: "order",
        entityId: order.id,
        title: "Aged pending order",
        detail: `Order has been pending for ${ageHours.toFixed(1)} hours.`,
        recommendation: "Escalate or route to completion queue.",
        fixed: false,
      });
    }

    if (order.type === "lab" && ageHours > 24 && adminConfig.modules.integrations.labcorpOutbound) {
      let fixed = false;
      if (autofix) {
        const hasRoutingTag = (order.instructions || "").toLowerCase().includes("labcorp routing");
        const routingTag = "Labcorp routing: outbound";
        await db.order.update({
          where: { id: order.id },
          data: {
            status: "sent",
            instructions: hasRoutingTag
              ? order.instructions
              : [order.instructions, routingTag].filter(Boolean).join(" | "),
          },
        });
        fixed = true;
      }
      findings.push({
        agent: "flow-optimizer",
        severity: "high",
        entityType: "order",
        entityId: order.id,
        title: "Lab order stuck in pending queue",
        detail: `Lab order pending for ${ageHours.toFixed(1)} hours with Labcorp outbound enabled.`,
        recommendation: "Route outbound to Labcorp to reduce turnaround time.",
        fixed,
      });
    }
  }

  return findings;
}

export async function runAgentSuite(args: {
  mode: RunMode;
  triggeredBy: string;
  role: StaffRole;
  agentIds?: AgentKey[];
}): Promise<AgentRun> {
  const startedAt = nowIso();
  const autofix = args.mode === "autofix" || args.mode === "autonomous";
  const enabledAgents = args.agentIds?.length
    ? AGENT_DEFINITIONS.filter((a) => args.agentIds!.includes(a.key))
    : AGENT_DEFINITIONS;

  const findings: AgentFinding[] = [];

  for (const agent of enabledAgents) {
    try {
      if (agent.key === "coding-billing") {
        findings.push(...(await codingBillingAgent(autofix)));
      } else if (agent.key === "medical-notes") {
        findings.push(...(await medicalNotesAgent(autofix)));
      } else if (agent.key === "validation") {
        findings.push(...(await validationAgent(autofix)));
      } else if (agent.key === "data-correction") {
        findings.push(...(await dataCorrectionAgent(autofix)));
      } else if (agent.key === "flow-optimizer") {
        findings.push(...(await flowOptimizerAgent(autofix)));
      }
    } catch (error) {
      findings.push({
        agent: agent.key,
        severity: "high",
        entityType: "system",
        entityId: "runtime",
        title: `${agent.name} execution error`,
        detail: error instanceof Error ? error.message : "Unknown runtime error",
        recommendation: "Review function logs and retry agent run.",
        fixed: false,
      });
    }
  }

  const run: AgentRun = {
    id: makeRunId(),
    startedAt,
    completedAt: nowIso(),
    mode: args.mode,
    triggeredBy: args.triggeredBy,
    findings,
    metrics: summarize(findings),
  };

  const previous = await readRuns();
  await writeRuns([run, ...previous]);

  if (run.metrics.fixedCount > 0) {
    await db.auditLog.create({
      data: {
        userId: args.triggeredBy,
        action: "agent-autofix",
        resource: "AgentSuite",
        resourceId: run.id,
        meta: JSON.stringify({ mode: args.mode, fixedCount: run.metrics.fixedCount }),
      },
    });
  }

  return run;
}

export async function getAgentOpsSnapshot() {
  const runs = await readRuns();
  return {
    agents: AGENT_DEFINITIONS,
    runs,
    latestRun: runs[0] ?? null,
  };
}
