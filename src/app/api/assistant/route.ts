import { NextResponse } from "next/server";
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

function classifyIntent(message: string) {
  const text = message.toLowerCase();

  if (/(reschedule|move\s+my\s+appointment|change\s+my\s+appointment|reagendar|reprogramar|cambiar\s+mi\s+cita)/.test(text)) return "reschedule" as const;
  if (/(cancel\s+my\s+appointment|cancel\s+appointment|remove\s+appointment|cancelar\s+mi\s+cita|cancelar\s+cita)/.test(text)) return "cancel" as const;
  if (/(schedule|book|new\s+appointment|agendar|programar\s+cita|nueva\s+cita)/.test(text)) return "schedule" as const;
  if (/(my\s+appointments|next\s+appointment|upcoming\s+appointment|show\s+appointments|mis\s+citas|proxima\s+cita|mostrar\s+citas)/.test(text)) return "lookup" as const;
  return "faq" as const;
}

async function faqReply(message: string) {
  const config = await readAdminConfig();
  const text = message.toLowerCase();
  const lang = detectLang(message);

  if (/(phone|call|number|telefono|llamar|numero)/.test(text)) {
    return t(
      lang,
      `You can reach ${config.org.orgName} at ${config.branding.supportPhone}.`,
      `Puedes comunicarte con ${config.org.orgName} al ${config.branding.supportPhone}.`,
    );
  }

  if (/(email|support|correo|soporte|ayuda)/.test(text)) {
    return t(
      lang,
      `For support, email ${config.branding.supportEmail}.`,
      `Para soporte, escribe a ${config.branding.supportEmail}.`,
    );
  }

  if (/(website|site|url|web|sitio)/.test(text)) {
    return t(lang, `Our website is ${config.org.website}.`, `Nuestro sitio web es ${config.org.website}.`);
  }

  if (/(hours|open|close|horario|abren|cierran)/.test(text)) {
    return t(
      lang,
      "Office hours vary by provider and location. Please contact support for exact hours.",
      "Los horarios varian por proveedor y ubicacion. Contacta a soporte para horarios exactos.",
    );
  }

  return t(
    lang,
    "I can answer practice questions here in a conversational way. For appointment scheduling, rescheduling, cancellation, and upcoming appointment lookup, sign in to the patient portal.",
    "Puedo responder preguntas de la clinica de forma conversacional. Para agendar, reagendar, cancelar o ver proximas citas, inicia sesion en el portal de pacientes.",
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  const lang = detectLang(message);

  if (!message) {
    return NextResponse.json({ error: t(lang, "Message is required", "El mensaje es obligatorio") }, { status: 400 });
  }

  const intent = classifyIntent(message);
  if (intent !== "faq") {
    return NextResponse.json({
      reply: t(
        lang,
        "To manage appointments, please sign in to the patient portal assistant. I can still help with general practice information here.",
        "Para gestionar citas, inicia sesion en el asistente del portal de pacientes. Aqui tambien puedo ayudarte con informacion general.",
      ),
      action: {
        type: intent,
        status: "needs-input",
        note: t(lang, "Portal login required for appointment actions", "Se requiere acceso al portal para acciones de citas"),
      },
    });
  }

  const reply = await faqReply(message);
  return NextResponse.json({
    reply,
    action: {
      type: "faq",
      status: "ok",
      note: "Answered public FAQ",
    },
  });
}
