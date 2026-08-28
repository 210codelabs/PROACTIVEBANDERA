// Build the National Registry (NRCME) data payload for a completed DOT exam.
// FMCSA does NOT expose a public API to submit exam results — the certified
// medical examiner reports results on the National Registry portal. This module
// produces a structured JSON + XML export the examiner can retain/submit; the
// "transmit" action stages this payload (status = exported), it does not send.

type AnyExam = Record<string, any>;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[<>&'\"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" }[c] as string));
}

export function buildExamPayload(exam: AnyExam) {
  const json = {
    formVersion: "MCSA-5875 / MCSA-5876",
    generatedAt: new Date().toISOString(),
    driver: {
      name: exam.driverName,
      ...(exam.driverInfo || {}),
      signedAt: exam.driverSignedAt,
    },
    carrier: exam.carrier || null,
    examination: {
      vitals: exam.vitals || null,
      vision: exam.vision || null,
      hearing: exam.hearing || null,
      urinalysis: exam.urinalysis || null,
      physicalExam: exam.physicalExam || null,
    },
    determination: {
      outcome: exam.outcome,
      certificateMonths: exam.certMonths,
      expiresOn: exam.expiresOn,
      restrictions: exam.restrictions || [],
      additionalFormsRequired: exam.additionalFormsRequired || [],
      flags: exam.determinationFlags || null,
    },
    medicalExaminer: {
      name: exam.examinerName,
      nationalRegistryNumber: exam.examinerNrcme,
      licenseNumber: exam.examinerLicense,
      licenseState: exam.examinerLicenseState,
      examDate: exam.examDate,
    },
  };

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<DOTMedicalExam>",
    `  <Driver name=\"${esc(exam.driverName)}\" license=\"${esc(exam.driverInfo?.licenseNumber)}\" state=\"${esc(exam.driverInfo?.licenseState)}\"/>`,
    `  <Carrier dot=\"${esc(exam.carrier?.dotNumber)}\" name=\"${esc(exam.carrier?.legalName)}\"/>`,
    `  <Determination outcome=\"${esc(exam.outcome)}\" months=\"${esc(exam.certMonths)}\" expires=\"${esc(exam.expiresOn)}\"/>`,
    `  <MedicalExaminer name=\"${esc(exam.examinerName)}\" registry=\"${esc(exam.examinerNrcme)}\" license=\"${esc(exam.examinerLicense)}\"/>`,
    "</DOTMedicalExam>",
  ].join("\n");

  return { json, xml };
}
