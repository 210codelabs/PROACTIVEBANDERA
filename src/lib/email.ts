import { Resend } from "resend";

// Best-effort transactional email. If RESEND_API_KEY / EMAIL_FROM are not
// configured, we skip silently so the booking flow never fails on email.
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Generic transactional send. Skips silently if Resend isn't configured so
// scheduled jobs never crash. Returns the delivery outcome.
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<"sent" | "failed" | "skipped"> {
  if (!emailConfigured()) return "skipped";
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (recipients.length === 0) return "skipped";
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const res = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: recipients,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.subject,
    });
    return res.error ? "failed" : "sent";
  } catch {
    return "failed";
  }
}

function escapeHtml(v: string) {
  return v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}

type Lang = "en" | "es";

export async function sendBookingConfirmation(opts: {
  to: string;
  firstName: string;
  confirmation: string;
  serviceInterest?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  priorityCheckin?: boolean;
  scheduledAt?: string | null; // human-readable, when a real appointment was created
  lang?: Lang;
}): Promise<"sent" | "failed" | "skipped"> {
  if (!emailConfigured()) return "skipped";
  if (!opts.to) return "skipped";

  const lang: Lang = opts.lang === "es" ? "es" : "en";
  const t = COPY[lang];
  const name = escapeHtml(opts.firstName || (lang === "es" ? "paciente" : "there"));
  const conf = escapeHtml(opts.confirmation);

  const details: string[] = [];
  if (opts.serviceInterest) details.push(`${t.service}: ${escapeHtml(opts.serviceInterest)}`);
  if (opts.scheduledAt) {
    details.push(`${t.scheduledFor}: ${escapeHtml(opts.scheduledAt)}`);
  } else if (opts.preferredDate || opts.preferredTime) {
    details.push(`${t.preferred}: ${escapeHtml(`${opts.preferredDate ?? ""} ${opts.preferredTime ?? ""}`.trim())}`);
  }
  if (opts.priorityCheckin) details.push(t.priority);

  const subject = `${t.subject} ${opts.confirmation}`;
  const text = [
    `${t.hello} ${opts.firstName || ""},`.trim(),
    "",
    opts.scheduledAt ? t.introScheduled : t.introRequested,
    `${t.confirmationNumber}: ${opts.confirmation}`,
    ...details.map((d) => d.replace(/<[^>]+>/g, "")),
    "",
    t.footer,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#1e4fd8;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;font-size:20px">Proactive Clinic</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
        <p style="margin:0 0 12px">${t.hello} <strong>${name}</strong>,</p>
        <p style="margin:0 0 16px;color:#334155">${opts.scheduledAt ? t.introScheduled : t.introRequested}</p>
        <div style="background:#f1f5f9;border-radius:10px;padding:16px;text-align:center;margin:0 0 16px">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em">${t.confirmationNumber}</div>
          <div style="font-size:26px;font-weight:800;color:#1e4fd8;letter-spacing:.05em">${conf}</div>
        </div>
        ${details.length ? `<ul style="color:#334155;padding-left:18px;margin:0 0 16px">${details.map((d) => `<li>${d}</li>`).join("")}</ul>` : ""}
        <p style="margin:0;color:#64748b;font-size:13px">${t.footer}</p>
      </div>
    </div>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: [opts.to],
      subject,
      text,
      html,
      headers: { "Idempotency-Key": `booking/${opts.confirmation}` },
    });
    if (error) {
      console.error("[email] send failed:", error.message);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("[email] send threw:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

// Fixed internal recipients for sales/demo leads.
const DEMO_TO = "info@210codelabs.com";
const DEMO_CC = "andy@proactivemedclinic.com";

export type DemoRequestInput = {
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  role?: string | null;
  practiceSize?: string | null;
  interests?: string[];
  preferredTime?: string | null;
  message?: string | null;
  referenceId?: string | null;
};

/**
 * Send an URGENT internal notification for a new demo request. Goes to
 * info@210codelabs.com (CC andy@proactivemedclinic.com) with a fixed subject.
 * Reply-To is set to the prospect so the team can respond directly. Returns
 * "skipped" when Resend/EMAIL_FROM is not configured (the lead is still saved).
 */
export async function sendDemoRequest(opts: DemoRequestInput): Promise<"sent" | "failed" | "skipped"> {
  if (!emailConfigured()) return "skipped";

  const rows: [string, string | null | undefined][] = [
    ["Name", opts.name],
    ["Email", opts.email],
    ["Phone", opts.phone],
    ["Organization / Practice", opts.organization],
    ["Role / Title", opts.role],
    ["Practice size", opts.practiceSize],
    ["Interested in", (opts.interests || []).join(", ") || null],
    ["Preferred contact time", opts.preferredTime],
    ["Reference", opts.referenceId],
  ];
  const visible = rows.filter(([, v]) => v && String(v).trim());

  const text = [
    "URGENT — New demo request from a prospect.",
    "",
    ...visible.map(([k, v]) => `${k}: ${v}`),
    "",
    "Message:",
    opts.message || "(none)",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0a2540;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#f87171;font-weight:800">● Urgent — Demo Request</div>
        <h2 style="margin:4px 0 0;font-size:20px">New demo request from a prospect</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:22px">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
          ${visible.map(([k, v]) => `<tr><td style="padding:6px 8px;color:#64748b;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 8px;font-weight:600;color:#0f172a">${escapeHtml(String(v))}</td></tr>`).join("")}
        </table>
        ${opts.message ? `<div style="margin-top:14px;padding:14px;background:#f1f5f9;border-radius:10px;color:#334155"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px">Message</div>${escapeHtml(opts.message)}</div>` : ""}
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">Reply directly to this email to reach ${escapeHtml(opts.name)} (${escapeHtml(opts.email)}).</p>
      </div>
    </div>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: [DEMO_TO],
      cc: [DEMO_CC],
      replyTo: opts.email || undefined,
      subject: "Demo Request from Prospect",
      text,
      html,
      headers: {
        "X-Priority": "1 (Highest)",
        "X-MSMail-Priority": "High",
        Importance: "high",
        Priority: "urgent",
        ...(opts.referenceId ? { "Idempotency-Key": `demo/${opts.referenceId}` } : {}),
      },
    });
    if (error) {
      console.error("[email] demo request send failed:", error.message);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("[email] demo request send threw:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

const COPY = {
  en: {
    subject: "Your Proactive Clinic request",
    hello: "Hello",
    introRequested: "We received your visit request. Our front desk will contact you shortly to confirm your appointment.",
    introScheduled: "Your appointment has been scheduled. We look forward to seeing you.",
    confirmationNumber: "Confirmation number",
    service: "Service",
    preferred: "Preferred time",
    scheduledFor: "Scheduled for",
    priority: "★ You have priority check-in as a current patient.",
    footer: "Please keep this confirmation number for your records. Reply to this email or call us if you need to make a change.",
  },
  es: {
    subject: "Su solicitud en Proactive Clinic",
    hello: "Hola",
    introRequested: "Recibimos su solicitud de visita. Nuestra recepción se comunicará con usted en breve para confirmar su cita.",
    introScheduled: "Su cita ha sido agendada. Esperamos verle pronto.",
    confirmationNumber: "Número de confirmación",
    service: "Servicio",
    preferred: "Horario preferido",
    scheduledFor: "Agendada para",
    priority: "★ Tiene registro prioritario como paciente actual.",
    footer: "Conserve este número de confirmación. Responda a este correo o llámenos si necesita hacer un cambio.",
  },
} as const;
