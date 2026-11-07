// Fill the OFFICIAL FMCSA AcroForm templates (MCSA-5875 & MCSA-5876) by field
// name, for an exact federal-format match. Templates live in
// /public/dot-templates and are filled at runtime with pdf-lib.

import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

const TEMPLATE_DIR = path.join(process.cwd(), "public", "dot-templates");

function readTemplate(file: string): Uint8Array {
  return fs.readFileSync(path.join(TEMPLATE_DIR, file));
}

function d(val?: any): string {
  if (!val) return "";
  try {
    const raw = val instanceof Date ? val.toISOString().slice(0, 10) : String(val);
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (date) return `${date[2]}/${date[3]}/${date[1]}`;
    return new Date(val).toLocaleDateString("en-US");
  } catch { return ""; }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mkHelpers(form: any) {
  const text = (name: string, val: any) => {
    if (val == null || val === "") return;
    try { form.getTextField(name).setText(String(val)); } catch { /* field absent */ }
  };
  const radio = (name: string, val?: string | null) => {
    if (!val) return;
    try { form.getRadioGroup(name).select(val); } catch { /* option/field absent */ }
  };
  const check = (name: string, on?: boolean) => {
    if (!on) return;
    try { form.getCheckBox(name).check(); } catch { /* field absent */ }
  };
  const drop = (name: string, val?: string | null) => {
    if (!val) return;
    try {
      const dd = form.getDropdown(name);
      const opts: string[] = dd.getOptions();
      const exact = opts.find((o) => o === val) || opts.find((o) => o.toUpperCase() === String(val).toUpperCase());
      if (exact) dd.select(exact);
    } catch { /* field absent */ }
  };
  return { text, radio, check, drop };
}

const STANDARDS: Record<string, string> = {
  meetsStandards: "Meets standards in 49 CFR 391.41; qualifies for 2-year certificate",
  meetsWithExemption: "Meets standards, but periodic monitoring required",
  doesNotMeet: "Does not meet standards",
  incomplete: "Incomplete examination",
  temporarilyDisqualified: "Determination pending",
};

const PE_MAP: Record<string, string> = {
  general: "generalButton", eyes: "eyesButton", ears: "earsButton", mouth_throat: "mouthButton",
  heart: "cardioButton", lungs: "lungsButton", abdomen: "abdomenButton", vascular: "vascularButton",
  genitourinary: "genitoButton", extremities: "jointsButton", spine: "spineButton",
  neurological: "neuroButton", skin: "skinButton",
};

export async function fillMcsa5875(exam: any, flatten = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(readTemplate("mcsa-5875.pdf"), { ignoreEncryption: true });
  const form = pdf.getForm();
  const { text, radio, check, drop } = mkHelpers(form);

  const di = exam.driverInfo || {};
  const v = exam.vitals || {}, vis = exam.vision || {}, he = exam.hearing || {}, ur = exam.urinalysis || {};
  const pe = exam.physicalExam || {};
  const first = di.firstName || (exam.driverName || "").split(" ")[0] || "";
  const last = di.lastName || (exam.driverName || "").split(" ").slice(1).join(" ") || "";
  const dob = d(di.dob);
  const examDate = d(exam.examDate);

  // Driver information
  text("driverFirst", first); text("driverLast", last); text("driverMiddle", di.middle);
  text("driverAddress", di.address); text("driverCity", di.city); text("driverZip", di.zip);
  text("driverPhone", di.phone); text("driverMail", di.email); text("driverDOB", dob);
  text("driverAge", di.age); text("driverLicense", di.licenseNumber);
  drop("driverState", di.licenseState); drop("driverIssue", di.licenseState);
  radio("licenseButton", di.hasCdl ? "Yes" : "No");

  // Current medications (clear mapping)
  if (di.medications) { radio("medicineButton", "Yes"); text("medicineDescribe", di.medications); }

  // Repeated per-page header fields (name / dob / exam date continuity)
  for (const s of ["2", "3", "4", "5"]) {
    text(`driverFirst${s}`, first); text(`driverLast${s}`, last);
    text(`dateBirth${s}`, dob); text(`examDate${s}`, examDate);
  }

  // Testing / vitals
  text("pulseMeasure", v.pulse);
  if (v.heightIn) { const inch = Number(v.heightIn); text("feetHeight", Math.floor(inch / 12)); text("inchesHeight", inch % 12); }
  text("poundsWeight", v.weightLb);
  text("sitSys", v.bpSystolic); text("sitDias", v.bpDiastolic);
  text("specgravNumber 3", ur.spGravity); text("proteinNumber", ur.protein); text("bloodNumber", ur.blood); text("sugarNumber", ur.sugar);

  // Vision
  text("uncorrectRight", vis.acuityRightUncorrected); text("uncorrectLeft", vis.acuityLeftUncorrected); text("uncorrectBoth", vis.acuityBothUncorrected);
  text("correctRight", vis.acuityRightCorrected); text("correctLeft", vis.acuityLeftCorrected); text("correcboth", vis.acuityBothCorrected);
  text("fieldRight", vis.fieldRightDeg); text("fieldLeft", vis.fieldLeftDeg);
  if (vis.colorPass != null) radio("distinguishButton", vis.colorPass === false ? "No" : "Yes");

  // Hearing
  text("whisperRight", he.whisperRightFt); text("whisperLeft", he.whisperLeftFt);

  // Physical examination (Normal / Abnormal)
  for (const [key, field] of Object.entries(PE_MAP)) {
    const it = pe[key];
    if (it && typeof it.abnormal === "boolean") radio(field, it.abnormal ? "Abnormal" : "Normal");
  }

  // Determination
  const fl = exam.determinationFlags || {};
  const stdKey = fl.doesNotMeet ? "doesNotMeet" : fl.temporarilyDisqualified ? "temporarilyDisqualified" : fl.incomplete ? "incomplete" : fl.meetsWithExemption ? "meetsWithExemption" : fl.meetsStandards ? "meetsStandards" : null;
  if (stdKey) radio("standardsButton", STANDARDS[stdKey]);
  const cm = Number(exam.certMonths);
  if (cm === 3) radio("qualifyButton", "Driver qualified for 3 months.");
  else if (cm === 6) radio("qualifyButton", "Driver qualified for 6 months.");
  else if (cm === 12) radio("qualifyButton", "Driver qualified for 1 year.");
  else if (cm && cm !== 24) { radio("qualifyButton", "Driver qualified for other length of time."); text("otherQualify", `${cm} months`); }
  text("certDate", examDate); text("expireDate", d(exam.expiresOn));

  // Restrictions
  const restr: string[] = exam.restrictions || [];
  check("correctBox", restr.includes("corrective_lenses"));
  check("hearBox", restr.includes("hearing_aid"));
  check("speBox", restr.includes("spe"));
  check("exemptBox", restr.includes("driving_exempt_intracity"));
  check("waiverBox", restr.includes("vision_exemption") || restr.includes("diabetes_exemption"));

  // Medical examiner
  text("examName", exam.examinerName); text("nationalRegister", exam.examinerNrcme);
  text("certNumber", exam.examinerLicense); drop("medicalState", exam.examinerLicenseState);
  text("examSignature", exam.examinerSignature); text("driverSignature", exam.driverSignature);
  text("examNameState", exam.examinerName); text("nationalRegisterState", exam.examinerNrcme);
  text("certNumberState", exam.examinerLicense);
  text("signatureDate", d(exam.driverSignedAt || exam.examDate));

  form.updateFieldAppearances();
  if (flatten) form.flatten();
  return pdf.save();
}

export async function fillMcsa5876(exam: any, flatten = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(readTemplate("mcsa-5876.pdf"), { ignoreEncryption: true });
  const form = pdf.getForm();
  const { text, check, drop } = mkHelpers(form);

  const di = exam.driverInfo || {};
  const first = di.firstName || (exam.driverName || "").split(" ")[0] || "";
  const last = di.lastName || (exam.driverName || "").split(" ").slice(1).join(" ") || "";

  text("cmvFirst", first); text("cmvLast", last);
  text("cmvStreet", di.address); text("cmvCity", di.city); text("cmvZip", di.zip);
  drop("cmvState", di.licenseState); text("driverNumber", di.licenseNumber);
  text("expDate", d(exam.expiresOn)); text("examDate", d(exam.examDate));

  text("examName", exam.examinerName); text("examNumber", exam.examinerLicense);
  text("examRegistry", exam.examinerNrcme); drop("examState", exam.examinerLicenseState);
  drop("examStateTwo", exam.examinerLicenseState);
  text("examSignature", exam.examinerSignature); text("driverSignature", exam.driverSignature);

  const restr: string[] = exam.restrictions || [];
  check("lensBox", restr.includes("corrective_lenses"));
  check("hearBox", restr.includes("hearing_aid"));
  check("speBox", restr.includes("spe"));
  check("intraBox", restr.includes("driving_exempt_intracity"));
  check("waiverBox", restr.includes("vision_exemption") || restr.includes("diabetes_exemption"));

  form.updateFieldAppearances();
  if (flatten) form.flatten();
  return pdf.save();
}
