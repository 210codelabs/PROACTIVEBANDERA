import { NextResponse } from "next/server";
import { addMinutes, isValid, parse, parseISO } from "date-fns";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";
import { readAdminConfig } from "@/lib/admin/store";

type Lang = "es" | "en";

function detectLang(input: string): Lang {
  const text = input.toLowerCase();
  if (/[\u00c0-\u017f]/.test(text)) return "es";
  if (/(hola|buenos|buenas|gracias|cita|agendar|reagendar|cancelar|portal|ayuda|clinica|correo|telefono)/.test(text)) return "es";
  return "en";
}

function t(lang: Lang, en: string, es: string) {
  return lang === "es" ? es : en;
}

type AssistantAction = {
  type: "schedule" | "reschedule" | "cancel" | "lookup" | "faq";
  status: "ok" | "needs-input" | "failed";
  note: string;
};

function parseDateTimeFromText(input: string) {
  const text = input.toLowerCase();

  const isoDateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const timeMatch = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  if (!isoDateMatch || !timeMatch) return null;

  const datePart = isoDateMatch[1];
  let hours = 9;
  let minutes = 0;

  if (timeMatch[1]) {
    const h12 = Number(timeMatch[1]);
    const mm = Number(timeMatch[2] || "0");
    const meridiem = timeMatch[3];
    hours = h12 % 12 + (meridiem === "pm" ? 12 : 0);
    minutes = mm;
  } else if (timeMatch[4]) {
    hours = Number(timeMatch[4]);
    minutes = Number(timeMatch[5]);
  }

  const dt = parse(`${datePart} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`, "yyyy-MM-dd HH:mm", new Date());
  return isValid(dt) ? dt : null;
}

function inferLocation(input: string) {
  const text = input.toLowerCase();
  if (text.includes("telehealth") || text.includes("virtual") || text.includes("video")) return "telehealth";
  if (text.includes("home") || text.includes("house")) return "home-visit";
  return "in-office";
}

async function pickProvider(input: string) {
  const providers = await db.user.findMany({
    where: { role: "provider", active: true },
    orderBy: { lastName: "asc" },
    take: 25,
  });
  if (providers.length === 0) return null;

  const text = input.toLowerCase();
  const matched = providers.find(
    (p) => text.includes(p.lastName.toLowerCase()) || text.includes(p.firstName.toLowerCase()),
  );

  return matched || providers[0];
}

async function pickService(input: string) {
  const services = await db.serviceType.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 50 });
  if (services.length === 0) return null;

  const text = input.toLowerCase();
  const matched = services.find((s) => text.includes(s.name.toLowerCase()) || text.includes(s.category.toLowerCase()));
  return matched || null;
}

async function providerHasConflict(providerId: string, startsAt: Date, endsAt: Date) {
  const conflict = await db.appointment.findFirst({
    where: {
      providerId,
      status: { notIn: ["cancelled", "completed", "no-show"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });

  return !!conflict;
}

function classifyIntent(message: string) {
  const text = message.toLowerCase();

  if (/(reschedule|move\s+my\s+appointment|change\s+my\s+appointment|reagendar|reprogramar|cambiar\s+mi\s+cita)/.test(text)) return "reschedule" as const;
  if (/(cancel\s+my\s+appointment|cancel\s+appointment|remove\s+appointment|cancelar\s+mi\s+cita|cancelar\s+cita)/.test(text)) return "cancel" as const;
  if (/(schedule|book|new\s+appointment|agendar|programar\s+cita|nueva\s+cita)/.test(text)) return "schedule" as const;
  if (/(my\s+appointments|next\s+appointment|upcoming\s+appointment|show\s+appointments|mis\s+citas|proxima\s+cita|mostrar\s+citas)/.test(text)) return "lookup" as const;
  return "faq" as const;
}

async function scheduleForPatient(message: string, patientId: string, lang: Lang): Promise<{ reply: string; action: AssistantAction }> {
  try {
    const start = parseDateTimeFromText(message);
    if (!start) {
      return {
        reply: t(
          lang,
          "I can schedule this for you. Please include date and time like: schedule PT on 2026-05-28 at 3:30 PM.",
          "Puedo agendar esto por ti. Incluye fecha y hora, por ejemplo: agenda PT el 2026-05-28 a las 3:30 PM.",
        ),
        action: { type: "schedule", status: "needs-input", note: "Missing date/time" },
      };
    }

    const provider = await pickProvider(message);
    if (!provider) {
      return {
        reply: t(
          lang,
          "Scheduling is currently unavailable because no active providers are available.",
          "La programacion no esta disponible en este momento porque no hay proveedores activos.",
        ),
        action: { type: "schedule", status: "failed", note: "No active providers" },
      };
    }

    const service = await pickService(message);
    const durationMin = service?.durationMin ?? 30;
    const end = addMinutes(start, durationMin);

    const conflict = await providerHasConflict(provider.id, start, end);
    if (conflict) {
      let suggestion = addMinutes(start, 30);
      let suggestionText = "";
      for (let i = 0; i < 8; i++) {
        const suggestionEnd = addMinutes(suggestion, durationMin);
        if (!(await providerHasConflict(provider.id, suggestion, suggestionEnd))) {
          suggestionText = t(
            lang,
            ` Next available with ${provider.firstName} ${provider.lastName} is ${suggestion.toLocaleString()}.`,
            ` La proxima disponibilidad con ${provider.firstName} ${provider.lastName} es ${suggestion.toLocaleString()}.`,
          );
          break;
        }
        suggestion = addMinutes(suggestion, 30);
      }

      return {
        reply: t(
          lang,
          `That time is not available.${suggestionText || " Please provide another time."}`,
          `Ese horario no esta disponible.${suggestionText || " Indica otro horario, por favor."}`,
        ),
        action: { type: "schedule", status: "failed", note: "Provider conflict" },
      };
    }

    const reason = message.length > 180 ? message.slice(0, 180) : message;
    const appointment = await db.appointment.create({
      data: {
        patientId,
        providerId: provider.id,
        serviceTypeId: service?.id ?? null,
        startsAt: start,
        endsAt: end,
        location: inferLocation(message),
        reason,
        status: "scheduled",
      },
      include: { provider: true, serviceType: true },
    });

    return {
      reply: t(
        lang,
        `Scheduled. Your appointment is set for ${appointment.startsAt.toLocaleString()} with ${appointment.provider.firstName} ${appointment.provider.lastName}${appointment.serviceType ? ` (${appointment.serviceType.name})` : ""}.`,
        `Listo. Tu cita quedo programada para ${appointment.startsAt.toLocaleString()} con ${appointment.provider.firstName} ${appointment.provider.lastName}${appointment.serviceType ? ` (${appointment.serviceType.name})` : ""}.`,
      ),
      action: { type: "schedule", status: "ok", note: `Created ${appointment.id}` },
    };
  } catch (error) {
    return {
      reply: t(
        lang,
        "I could not complete scheduling right now. Please try a different time or try again shortly.",
        "No pude completar la programacion en este momento. Intenta con otro horario o vuelve a intentarlo en breve.",
      ),
      action: {
        type: "schedule",
        status: "failed",
        note: error instanceof Error ? error.message : "Scheduling runtime error",
      },
    };
  }
}

async function rescheduleForPatient(message: string, patientId: string, lang: Lang): Promise<{ reply: string; action: AssistantAction }> {
  try {
    const start = parseDateTimeFromText(message);
    if (!start) {
      return {
        reply: t(
          lang,
          "I can reschedule your appointment. Please include the new date and time, for example: reschedule to 2026-05-30 at 10:00 AM.",
          "Puedo reagendar tu cita. Incluye la nueva fecha y hora, por ejemplo: reagenda para 2026-05-30 a las 10:00 AM.",
        ),
        action: { type: "reschedule", status: "needs-input", note: "Missing new date/time" },
      };
    }

    const target = await db.appointment.findFirst({
      where: {
        patientId,
        status: { in: ["scheduled", "checked-in", "in-room"] },
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
      include: { serviceType: true, provider: true },
    });

    if (!target) {
      return {
        reply: t(
          lang,
          "I could not find an upcoming appointment to reschedule.",
          "No encontre una proxima cita para reagendar.",
        ),
        action: { type: "reschedule", status: "failed", note: "No upcoming appointment" },
      };
    }

    const durationMin = target.serviceType?.durationMin ?? 30;
    const end = addMinutes(start, durationMin);

    const conflict = await db.appointment.findFirst({
      where: {
        providerId: target.providerId,
        id: { not: target.id },
        status: { notIn: ["cancelled", "completed", "no-show"] },
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        reply: t(
          lang,
          "That new time is not available for your provider. Please send another time.",
          "Ese nuevo horario no esta disponible para tu proveedor. Comparte otro horario.",
        ),
        action: { type: "reschedule", status: "failed", note: "Provider conflict" },
      };
    }

    const updated = await db.appointment.update({
      where: { id: target.id },
      data: { startsAt: start, endsAt: end, status: "scheduled" },
    });

    return {
      reply: t(
        lang,
        `Done. Your appointment was rescheduled to ${updated.startsAt.toLocaleString()}.`,
        `Listo. Tu cita fue reprogramada para ${updated.startsAt.toLocaleString()}.`,
      ),
      action: { type: "reschedule", status: "ok", note: `Updated ${updated.id}` },
    };
  } catch (error) {
    return {
      reply: t(
        lang,
        "I could not complete rescheduling right now. Please try again shortly.",
        "No pude completar la reprogramacion en este momento. Intentalo de nuevo en breve.",
      ),
      action: {
        type: "reschedule",
        status: "failed",
        note: error instanceof Error ? error.message : "Rescheduling runtime error",
      },
    };
  }
}

async function cancelForPatient(patientId: string, lang: Lang): Promise<{ reply: string; action: AssistantAction }> {
  try {
    const target = await db.appointment.findFirst({
      where: {
        patientId,
        status: { in: ["scheduled", "checked-in", "in-room"] },
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
    });

    if (!target) {
      return {
        reply: t(lang, "I could not find an upcoming appointment to cancel.", "No encontre una proxima cita para cancelar."),
        action: { type: "cancel", status: "failed", note: "No upcoming appointment" },
      };
    }

    await db.appointment.update({ where: { id: target.id }, data: { status: "cancelled" } });

    return {
      reply: t(
        lang,
        `Your appointment on ${target.startsAt.toLocaleString()} has been cancelled.`,
        `Tu cita del ${target.startsAt.toLocaleString()} ha sido cancelada.`,
      ),
      action: { type: "cancel", status: "ok", note: `Cancelled ${target.id}` },
    };
  } catch (error) {
    return {
      reply: t(
        lang,
        "I could not complete cancellation right now. Please try again shortly.",
        "No pude completar la cancelacion en este momento. Intentalo de nuevo en breve.",
      ),
      action: {
        type: "cancel",
        status: "failed",
        note: error instanceof Error ? error.message : "Cancellation runtime error",
      },
    };
  }
}

async function lookupForPatient(patientId: string, lang: Lang): Promise<{ reply: string; action: AssistantAction }> {
  const upcoming = await db.appointment.findMany({
    where: { patientId, startsAt: { gte: new Date() }, status: { not: "cancelled" } },
    include: { provider: true, serviceType: true },
    orderBy: { startsAt: "asc" },
    take: 3,
  });

  if (upcoming.length === 0) {
    return {
      reply: t(lang, "You do not have any upcoming appointments right now.", "No tienes citas proximas por ahora."),
      action: { type: "lookup", status: "ok", note: "No upcoming appointments" },
    };
  }

  const lines = upcoming.map(
    (a, idx) =>
      t(
        lang,
        `${idx + 1}. ${a.startsAt.toLocaleString()} with ${a.provider.firstName} ${a.provider.lastName}${a.serviceType ? ` (${a.serviceType.name})` : ""}`,
        `${idx + 1}. ${a.startsAt.toLocaleString()} con ${a.provider.firstName} ${a.provider.lastName}${a.serviceType ? ` (${a.serviceType.name})` : ""}`,
      ),
  );

  return {
    reply: t(lang, `Here are your upcoming appointments:\n${lines.join("\n")}`, `Estas son tus proximas citas:\n${lines.join("\n")}`),
    action: { type: "lookup", status: "ok", note: `Returned ${upcoming.length} appointments` },
  };
}

async function faqReply(message: string, lang: Lang) {
  const config = await readAdminConfig();
  const text = message.toLowerCase();

  if (/(phone|call|number|telefono|llamar|numero)/.test(text)) {
    return {
      reply: t(
        lang,
        `You can reach ${config.org.orgName} at ${config.branding.supportPhone}.`,
        `Puedes comunicarte con ${config.org.orgName} al ${config.branding.supportPhone}.`,
      ),
      action: { type: "faq", status: "ok", note: "Answered phone question" } as AssistantAction,
    };
  }

  if (/(email|support|correo|soporte|ayuda)/.test(text)) {
    return {
      reply: t(
        lang,
        `For support, email ${config.branding.supportEmail}.`,
        `Para soporte, escribe a ${config.branding.supportEmail}.`,
      ),
      action: { type: "faq", status: "ok", note: "Answered email question" } as AssistantAction,
    };
  }

  if (/(website|site|url|web|sitio)/.test(text)) {
    return {
      reply: t(lang, `Our website is ${config.org.website}.`, `Nuestro sitio web es ${config.org.website}.`),
      action: { type: "faq", status: "ok", note: "Answered website question" } as AssistantAction,
    };
  }

  if (/(portal|documents|download|documentos|descargar)/.test(text)) {
    return {
      reply: config.portal.allowDocumentDownload
        ? t(
            lang,
            "You can view and download documents in the Documents section of the portal.",
            "Puedes ver y descargar documentos en la seccion de Documentos del portal.",
          )
        : t(
            lang,
            "Document download is currently disabled in the portal. You can still view your records.",
            "La descarga de documentos esta desactivada por ahora en el portal. Aun puedes ver tus registros.",
          ),
      action: { type: "faq", status: "ok", note: "Answered portal documents question" } as AssistantAction,
    };
  }

  if (/(pay|payment|bill|pago|factura|pagar)/.test(text)) {
    return {
      reply: config.portal.allowOnlinePayments
        ? t(
            lang,
            "Online payments are enabled. You can complete payment in the Billing section.",
            "Los pagos en linea estan habilitados. Puedes completar el pago en la seccion de Facturacion.",
          )
        : t(
            lang,
            "Online payments are not enabled yet. Please contact the front desk for payment assistance.",
            "Los pagos en linea aun no estan habilitados. Contacta la recepcion para ayuda con pagos.",
          ),
      action: { type: "faq", status: "ok", note: "Answered billing question" } as AssistantAction,
    };
  }

  return {
    reply: t(
      lang,
      "I can help with practice info and appointment tasks in natural conversation. Try: 'show my next appointment', 'schedule on 2026-05-30 at 2:00 PM', 'reschedule to 2026-06-01 at 10:30 AM', or 'cancel my appointment'.",
      "Puedo ayudarte con informacion de la clinica y tareas de citas en lenguaje natural. Prueba: 'muestra mi proxima cita', 'agenda para 2026-05-30 a las 2:00 PM', 'reagenda para 2026-06-01 a las 10:30 AM' o 'cancela mi cita'.",
    ),
    action: { type: "faq", status: "ok", note: "Returned capability help" } as AssistantAction,
  };
}

export async function POST(req: Request) {
  const session = await requirePortalSession();
  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  const lang = detectLang(message);

  if (!message) {
    return NextResponse.json({ error: t(lang, "Message is required", "El mensaje es obligatorio") }, { status: 400 });
  }

  const intent = classifyIntent(message);

  if (intent === "schedule") {
    const result = await scheduleForPatient(message, session.patientId, lang);
    return NextResponse.json(result);
  }

  if (intent === "reschedule") {
    const result = await rescheduleForPatient(message, session.patientId, lang);
    return NextResponse.json(result);
  }

  if (intent === "cancel") {
    const result = await cancelForPatient(session.patientId, lang);
    return NextResponse.json(result);
  }

  if (intent === "lookup") {
    const result = await lookupForPatient(session.patientId, lang);
    return NextResponse.json(result);
  }

  const result = await faqReply(message, lang);
  return NextResponse.json(result);
}
