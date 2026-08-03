// -------------------------------------------------------------------------
// Bilingual (English / Español) dictionary for the Proactive Clinic online
// intake. tr() falls back to the original English text when no translation
// exists (so clinical/print-only forms stay English by default).
// -------------------------------------------------------------------------

export type Lang = "en" | "es";

// English string -> Spanish
export const ES: Record<string, string> = {
  // Form meta
  "New Patient Intake": "Admisión de Paciente Nuevo",
  "Physical Recovery & Therapy — New Patient Registration":
    "Recuperación Física y Terapia — Registro de Paciente Nuevo",
  "First-time patients starting physical therapy, rehabilitation, or pain-management care.":
    "Pacientes que inician terapia física, rehabilitación o manejo del dolor por primera vez.",
  "Follow-Up Check-In": "Registro de Seguimiento",
  "Physical Recovery & Therapy — Existing Patient Visit Update":
    "Recuperación Física y Terapia — Actualización de Visita de Paciente Existente",
  "Returning patients checking in for a therapy or pain-management follow-up visit.":
    "Pacientes que regresan para una visita de seguimiento de terapia o manejo del dolor.",

  // Section titles
  "Patient Information": "Información del Paciente",
  "Injury / Accident Details": "Detalles de la Lesión / Accidente",
  "Injury Body Map": "Mapa Corporal de Lesiones",
  "Past & Present Medical History": "Historial Médico Pasado y Presente",
  "Legal / Attorney Information": "Información Legal / del Abogado",
  "Consent to Treatment": "Consentimiento para el Tratamiento",
  "Radiology / Imaging Consent": "Consentimiento de Radiología / Imágenes",
  "Acknowledgement & Signature": "Reconocimiento y Firma",
  "Find Your Record": "Localice su Expediente",
  "How Are You Feeling Today?": "¿Cómo se Siente Hoy?",
  "Consent Re-Acknowledgement": "Reconfirmación del Consentimiento",
  "Signature": "Firma",

  // Section descriptions
  "Tell us who you are. This information creates your Proactive Clinic chart. Please print clearly if completing on paper.":
    "Cuéntenos quién es usted. Esta información crea su expediente en Proactive Clinic. Escriba con letra clara si completa en papel.",
  "Complete this section only if your visit is related to an injury or motor-vehicle accident. If not accident-related, skip to the next section.":
    "Complete esta sección solo si su visita está relacionada con una lesión o un accidente automovilístico. Si no está relacionada con un accidente, pase a la siguiente sección.",
  "Tap on the body where you feel pain or injury. Add as many points as you need — front and back.":
    "Toque en el cuerpo donde siente dolor o lesión. Agregue tantos puntos como necesite — frente y espalda.",
  "Help our clinical team plan safe, effective therapy by sharing your health background. Leave blank anything that does not apply.":
    "Ayude a nuestro equipo clínico a planificar una terapia segura y eficaz compartiendo sus antecedentes de salud. Deje en blanco lo que no aplique.",
  "Complete only if your care is related to a personal-injury (PIP) or auto-accident claim managed by an attorney.":
    "Complete solo si su atención está relacionada con un reclamo por lesiones personales (PIP) o accidente automovilístico gestionado por un abogado.",
  "Please read carefully. Your signature at the end of this form confirms your agreement.":
    "Lea con atención. Su firma al final de este formulario confirma su acuerdo.",
  "Bilingual authorization for diagnostic imaging (English & Español).":
    "Autorización bilingüe para imágenes diagnósticas (Inglés y Español).",
  "By signing below, you confirm the information provided is accurate to the best of your knowledge.":
    "Al firmar a continuación, usted confirma que la información proporcionada es correcta a su leal saber y entender.",
  "Confirm your identity so we can attach today's update to your existing Proactive Clinic chart.":
    "Confirme su identidad para adjuntar la actualización de hoy a su expediente existente en Proactive Clinic.",
  "Tell us how you have been doing since your last visit so your provider can adjust your plan.":
    "Cuéntenos cómo se ha sentido desde su última visita para que su proveedor pueda ajustar su plan.",
  "Please re-confirm your ongoing consent for today's treatment.":
    "Por favor reconfirme su consentimiento continuo para el tratamiento de hoy.",
  "By signing you confirm today's update is accurate.":
    "Al firmar confirma que la actualización de hoy es correcta.",

  // Headings
  "Emergency Contact": "Contacto de Emergencia",
  "Lifestyle & Habits": "Estilo de Vida y Hábitos",
  "For patients of childbearing age": "Para pacientes en edad fértil",

  // Field labels
  "First Name": "Nombre",
  "Last Name": "Apellido",
  "Date of Birth": "Fecha de Nacimiento",
  "Age": "Edad",
  "Sex": "Sexo",
  "Phone Number": "Número de Teléfono",
  "Email": "Correo Electrónico",
  "Home Address": "Domicilio",
  "Referred By": "Referido Por",
  "Initial Visit Date": "Fecha de Primera Visita",
  "Name": "Nombre",
  "Date of Accident / Injury": "Fecha del Accidente / Lesión",
  "What type of vehicle were you in?": "¿En qué tipo de vehículo estaba?",
  "If yes, name the facility": "Si respondió sí, indique el centro médico",
  "Describe your current symptoms / present illness":
    "Describa sus síntomas actuales / enfermedad actual",
  "Medications you are currently taking": "Medicamentos que toma actualmente",
  "Other medical conditions": "Otras condiciones médicas",
  "Previous accidents / injuries": "Accidentes / lesiones anteriores",
  "Past surgeries": "Cirugías anteriores",
  "Allergies": "Alergias",
  "Alcohol": "Alcohol",
  "Smoking": "Tabaco",
  "Recreational Drugs": "Drogas Recreativas",
  "Coffee / Caffeine": "Café / Cafeína",
  "Date of last menstruation": "Fecha de la última menstruación",
  "Attorney / Law Firm Name": "Nombre del Abogado / Bufete",
  "Firm Address": "Dirección del Bufete",
  "Firm Phone / Fax": "Teléfono / Fax del Bufete",
  "Case #": "N.º de Caso",
  "BI Policy Amount": "Monto de la Póliza (BI)",
  "Insurance Carrier": "Compañía de Seguros",
  "Patient / Guardian Signature": "Firma del Paciente / Tutor",
  "Patient Signature": "Firma del Paciente",
  "Date": "Fecha",
  "MRN (Medical Record #)": "MRN (N.º de Expediente)",
  "Current symptoms / present illness": "Síntomas actuales / enfermedad actual",
  "Current pain level (0 = none, 10 = worst)": "Nivel de dolor actual (0 = ninguno, 10 = el peor)",
  "Since your last visit, your symptoms are:": "Desde su última visita, sus síntomas están:",
  "If yes, please describe": "Si respondió sí, describa",
  "Any changes to your medications?": "¿Algún cambio en sus medicamentos?",
  "Mark your areas of pain": "Marque sus áreas de dolor",

  // Yes/No questions
  "Were you wearing your seatbelt?": "¿Llevaba puesto el cinturón de seguridad?",
  "Were you seen and/or treated in an emergency room?":
    "¿Fue atendido y/o tratado en una sala de emergencias?",
  "Is there any possibility you are pregnant?": "¿Existe alguna posibilidad de que esté embarazada?",
  "Any new symptoms or injuries?": "¿Algún síntoma o lesión nueva?",

  // Checkbox group labels
  "From what side were you hit?": "¿De qué lado fue impactado?",
  "You were the:": "Usted era el/la:",
  "If a passenger, where were you seated?": "Si era pasajero, ¿dónde estaba sentado?",
  "At the time of impact, what did you hit?": "Al momento del impacto, ¿con qué se golpeó?",
  "Where were you injured?": "¿Dónde se lesionó?",
  "Do you have any of the following?": "¿Tiene alguna de las siguientes condiciones?",

  // Options
  "Female": "Femenino",
  "Male": "Masculino",
  "Other": "Otro",
  "Front": "Frente",
  "Rear": "Atrás",
  "Left Side": "Lado Izquierdo",
  "Right Side": "Lado Derecho",
  "Driver": "Conductor",
  "Passenger": "Pasajero",
  "Pedestrian": "Peatón",
  "Back": "Atrás",
  "Door": "Puerta",
  "Seat": "Asiento",
  "Window": "Ventana",
  "Steering Wheel": "Volante",
  "Neck": "Cuello",
  "Mid Back": "Espalda Media",
  "Lower Back": "Espalda Baja",
  "Shoulder": "Hombro",
  "Knee": "Rodilla",
  "Hypertension": "Hipertensión",
  "Diabetes": "Diabetes",
  "Heart Disease": "Enfermedad Cardíaca",
  "Asthma": "Asma",
  "None": "Ninguna",
  "Much better": "Mucho mejor",
  "Better": "Mejor",
  "Same": "Igual",
  "Worse": "Peor",
  "Much worse": "Mucho peor",

  // Consent paragraphs
  "I authorize Proactive Clinic and its licensed providers, therapists, and clinical staff to perform the evaluation, physical therapy, rehabilitation, chiropractic, and pain-management treatment(s) that are determined to be necessary or advisable in the course of my care. I acknowledge that the general nature, expected benefits, and reasonable risks of treatment have been explained to me and that I have had the opportunity to ask questions. I understand no guarantee has been made as to the result of treatment and that I may withdraw this consent at any time.":
    "Autorizo a Proactive Clinic y a sus proveedores, terapeutas y personal clínico con licencia a realizar la evaluación, terapia física, rehabilitación, tratamiento quiropráctico y de manejo del dolor que se determinen necesarios o recomendables durante mi atención. Reconozco que se me ha explicado la naturaleza general, los beneficios esperados y los riesgos razonables del tratamiento, y que tuve la oportunidad de hacer preguntas. Entiendo que no se garantiza ningún resultado del tratamiento y que puedo retirar este consentimiento en cualquier momento.",
  "I understand that I am financially responsible for all charges regardless of insurance or third-party coverage. If my care is related to a motor-vehicle accident or personal-injury claim, I authorize Proactive Clinic to communicate with my attorney and/or insurer and to furnish records and bills related to my treatment.":
    "Entiendo que soy responsable financieramente de todos los cargos, independientemente del seguro o de la cobertura de terceros. Si mi atención está relacionada con un accidente automovilístico o un reclamo por lesiones personales, autorizo a Proactive Clinic a comunicarse con mi abogado y/o aseguradora y a proporcionar los registros y facturas relacionados con mi tratamiento.",
  "I authorize the performance of diagnostic X-ray and imaging examinations of myself which the provider(s) or the facility may consider necessary or advisable in the course of my examination and treatment.":
    "Autorizo la realización de exámenes de rayos X e imágenes diagnósticas que el proveedor o la institución consideren necesarios o recomendables durante mi evaluación y tratamiento.",
  "TO BE READ BY ALL PATIENTS OF CHILDBEARING AGE: X-rays taken during pregnancy may be harmful to an unborn child. The most sensitive period is the first three months. Please inform the provider or technician if there is any possibility that you may be pregnant. I certify that, to the best of my knowledge, I am NOT pregnant and I authorize the diagnostic imaging examination.":
    "PARA TODAS LAS PACIENTES EN EDAD FÉRTIL: Las radiografías tomadas durante el embarazo pueden ser dañinas para el feto. El período más sensible son los primeros tres meses. Informe al proveedor o técnico si existe alguna posibilidad de que esté embarazada. Certifico que, a mi leal saber y entender, NO estoy embarazada y autorizo el examen de imágenes diagnósticas.",

  // Ack labels
  "I have read and agree to the Consent to Treatment.":
    "He leído y acepto el Consentimiento para el Tratamiento.",
  "I acknowledge the financial and records-release statement.":
    "Reconozco la declaración financiera y de divulgación de registros.",
  "I authorize diagnostic imaging and certify the pregnancy statement (if applicable).":
    "Autorizo las imágenes diagnósticas y certifico la declaración de embarazo (si aplica).",
  "I re-confirm my consent to today's treatment.":
    "Reconfirmo mi consentimiento para el tratamiento de hoy.",
};

// UI chrome strings (not part of form definitions)
export const UI: Record<Lang, Record<string, string>> = {
  en: {
    kicker: "Patient Intake",
    welcome: "Welcome to Proactive Clinic",
    intro:
      "Complete your Physical Recovery & Therapy paperwork online before your visit — or download a printable copy to fill out offline. Choose the option that fits you.",
    startOnline: "Start online →",
    printableTitle: "Printable forms (for offline / in-office use)",
    printableDesc:
      "Download beautifully formatted, brand-ready PDFs. Includes patient intake and clinical documentation forms.",
    alsoOnline: "Also online",
    pdf: "PDF",
    preferPaper: "Prefer paper? Download a printable copy",
    submit: "Submit Intake",
    submitting: "Submitting…",
    back: "← Back",
    thanks: "Thank you — your intake was submitted",
    thanksSub: "A front-desk team member will verify your information at your visit.",
    confirmationNo: "Confirmation #",
    mrnNo: "Medical Record #",
    record: "Record",
    newPatient: "New patient created",
    matched: "Matched to existing chart",
    backHome: "Back to intake home",
    downloadCopy: "Download a filled copy (PDF)",
    errRequired: "Please provide your first name, last name and date of birth.",
    errSignature: "Please type your name as your electronic signature.",
    errAcks: "Please read and check each consent acknowledgement before submitting.",
    errSubmit: "Could not submit your intake.",
    errNetwork: "Network error. Please try again or ask the front desk for help.",
    yes: "Yes",
    no: "No",
    typeName: "Type your full legal name",
    sigNote: "Typing your name serves as your electronic signature.",
    bodyTapAdd: "Tap to add a point. Tap a point again to remove it.",
    bodyFront: "Front",
    bodyBack: "Back",
    bodyPoints: "point(s) marked",
    langLabel: "Español",
  },
  es: {
    kicker: "Admisión de Paciente",
    welcome: "Bienvenido a Proactive Clinic",
    intro:
      "Complete su documentación de Recuperación Física y Terapia en línea antes de su visita — o descargue una copia imprimible para llenarla sin conexión. Elija la opción que más le convenga.",
    startOnline: "Comenzar en línea →",
    printableTitle: "Formularios imprimibles (para uso sin conexión / en consultorio)",
    printableDesc:
      "Descargue PDFs con formato profesional y listos para la marca. Incluye formularios de admisión y documentación clínica.",
    alsoOnline: "También en línea",
    pdf: "PDF",
    preferPaper: "¿Prefiere papel? Descargue una copia imprimible",
    submit: "Enviar Admisión",
    submitting: "Enviando…",
    back: "← Atrás",
    thanks: "Gracias — su admisión fue enviada",
    thanksSub: "Un miembro de recepción verificará su información en su visita.",
    confirmationNo: "N.º de Confirmación",
    mrnNo: "N.º de Expediente",
    record: "Expediente",
    newPatient: "Se creó un paciente nuevo",
    matched: "Coincidió con un expediente existente",
    backHome: "Volver al inicio de admisión",
    downloadCopy: "Descargar copia completada (PDF)",
    errRequired: "Por favor proporcione su nombre, apellido y fecha de nacimiento.",
    errSignature: "Por favor escriba su nombre como firma electrónica.",
    errAcks: "Por favor lea y marque cada reconocimiento de consentimiento antes de enviar.",
    errSubmit: "No se pudo enviar su admisión.",
    errNetwork: "Error de red. Intente de nuevo o pida ayuda en recepción.",
    yes: "Sí",
    no: "No",
    typeName: "Escriba su nombre legal completo",
    sigNote: "Escribir su nombre sirve como su firma electrónica.",
    bodyTapAdd: "Toque para agregar un punto. Toque un punto de nuevo para quitarlo.",
    bodyFront: "Frente",
    bodyBack: "Espalda",
    bodyPoints: "punto(s) marcado(s)",
    langLabel: "English",
  },
};

export function tr(text: string | undefined, lang: Lang): string {
  if (!text) return "";
  if (lang === "en") return text;
  return ES[text] ?? text;
}

export function ui(lang: Lang, key: keyof (typeof UI)["en"]): string {
  return UI[lang][key] ?? UI.en[key] ?? String(key);
}
