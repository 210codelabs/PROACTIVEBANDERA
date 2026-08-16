/**
 * C-CDA (Consolidated CDA R2.1) — Continuity of Care Document (CCD) generator.
 *
 * Produces a human-readable, standards-shaped clinical summary for a single
 * patient, suitable for records requests / transitions of care. Each section
 * carries a narrative <text> table (what renders in a browser / CDA viewer)
 * plus coded structured entries where codes are recorded.
 *
 * Server-only. Maps local Prisma models directly to CDA.
 */

import { CLINIC } from "@/lib/intake/forms";

const OID = {
  ccdDoc: "2.16.840.1.113883.10.20.22.1.2",
  usHeader: "2.16.840.1.113883.10.20.22.1.1",
  loinc: "2.16.840.1.113883.6.1",
  icd10: "2.16.840.1.113883.6.90",
  cvx: "2.16.840.1.113883.12.292",
  snomed: "2.16.840.1.113883.6.96",
  ucum: "2.16.840.1.113883.6.8",
  adminGender: "2.16.840.1.113883.5.1",
  confidentiality: "2.16.840.1.113883.5.25",
  clinicRoot: "2.16.840.1.113883.19.5.99999.1", // example/local root
};

function esc(s: any): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function ts(d?: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}${p(x.getUTCHours())}${p(x.getUTCMinutes())}${p(x.getUTCSeconds())}+0000`;
}
function tsDay(d?: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}`;
}
function genderCode(sex?: string | null): { code: string; name: string } {
  const s = String(sex || "").toUpperCase();
  if (s === "M") return { code: "M", name: "Male" };
  if (s === "F") return { code: "F", name: "Female" };
  return { code: "UN", name: "Undifferentiated" };
}

// Build an HTML-ish narrative <table> for a section.
function narrativeTable(headers: string[], rows: string[][]): string {
  if (!rows.length) return `<text><paragraph>No information available.</paragraph></text>`;
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const trs = rows.map((r, i) =>
    `<tr ID="r${i}">${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`
  ).join("");
  return `<text><table border="1" width="100%"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></text>`;
}

export function buildCcda(patient: any, providerName: (id?: string | null) => string): string {
  const g = genderCode(patient.sex);
  const now = ts(new Date());
  const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();

  // ---------- narratives + entries ----------

  // Allergies (48765-2)
  const allergies = patient.allergies || [];
  const allergyText = narrativeTable(
    ["Substance", "Reaction", "Severity", "Status", "Noted"],
    allergies.map((a: any) => [a.substance, a.reaction || "—", a.severity || "—", a.status || "active", tsDay(a.onsetDate) || tsDay(a.createdAt) || "—"])
  );
  const allergyEntries = allergies.map((a: any) => `
      <entry typeCode="DRIV">
        <act classCode="ACT" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.30" extension="2015-08-01"/>
          <statusCode code="active"/>
          <effectiveTime><low value="${tsDay(a.onsetDate) || tsDay(a.createdAt)}"/></effectiveTime>
          <entryRelationship typeCode="SUBJ">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.7" extension="2014-06-09"/>
              <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
              <statusCode code="completed"/>
              <value xsi:type="CD"><originalText>${esc(a.substance)}</originalText></value>
              <participant typeCode="CSM">
                <participantRole classCode="MANU">
                  <playingEntity classCode="MMAT"><name>${esc(a.substance)}</name></playingEntity>
                </participantRole>
              </participant>
              ${a.reaction ? `<entryRelationship typeCode="MFST" inversionInd="true"><observation classCode="OBS" moodCode="EVN"><code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/><statusCode code="completed"/><value xsi:type="CD"><originalText>${esc(a.reaction)}</originalText></value></observation></entryRelationship>` : ""}
            </observation>
          </entryRelationship>
        </act>
      </entry>`).join("");

  // Medications (10160-0)
  const meds = patient.medications || [];
  const medText = narrativeTable(
    ["Medication", "Dose / Form", "Sig", "Status", "Started"],
    meds.map((m: any) => [m.name, [m.strength, m.form].filter(Boolean).join(" ") || "—", m.sig || "—", m.status || "active", tsDay(m.startDate) || "—"])
  );
  const medEntries = meds.map((m: any) => `
      <entry typeCode="DRIV">
        <substanceAdministration classCode="SBADM" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"/>
          <statusCode code="${m.status === "discontinued" ? "aborted" : "active"}"/>
          <effectiveTime xsi:type="IVL_TS"><low value="${tsDay(m.startDate) || tsDay(m.createdAt)}"/></effectiveTime>
          <consumable>
            <manufacturedProduct classCode="MANU">
              <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
              <manufacturedMaterial><code><originalText>${esc([m.name, m.strength, m.form].filter(Boolean).join(" "))}</originalText></code></manufacturedMaterial>
            </manufacturedProduct>
          </consumable>
        </substanceAdministration>
      </entry>`).join("");

  // Problems (11450-4)
  const problems = patient.problems || [];
  const probText = narrativeTable(
    ["Problem", "ICD-10", "Status", "Onset"],
    problems.map((p: any) => [p.description, p.icd10 || "—", p.status || "active", tsDay(p.onsetDate) || "—"])
  );
  const probEntries = problems.map((p: any) => `
      <entry typeCode="DRIV">
        <act classCode="ACT" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.3" extension="2015-08-01"/>
          <statusCode code="active"/>
          <effectiveTime><low value="${tsDay(p.onsetDate) || tsDay(p.createdAt)}"/></effectiveTime>
          <entryRelationship typeCode="SUBJ">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.4" extension="2015-08-01"/>
              <code code="55607006" codeSystem="${OID.snomed}" displayName="Problem"/>
              <statusCode code="completed"/>
              <effectiveTime><low value="${tsDay(p.onsetDate) || tsDay(p.createdAt)}"/></effectiveTime>
              <value xsi:type="CD" ${p.icd10 ? `code="${esc(p.icd10)}" codeSystem="${OID.icd10}" codeSystemName="ICD-10-CM"` : ""} displayName="${esc(p.description)}"><originalText>${esc(p.description)}</originalText></value>
            </observation>
          </entryRelationship>
        </act>
      </entry>`).join("");

  // Vital Signs (8716-3)
  const vitals = patient.vitals || [];
  const vitalText = narrativeTable(
    ["Date", "BP", "HR", "Temp (C)", "RR", "SpO2", "Ht (cm)", "Wt (kg)", "BMI"],
    vitals.map((v: any) => [
      tsDay(v.takenAt) || "—",
      (v.systolic != null || v.diastolic != null) ? `${v.systolic ?? "?"}/${v.diastolic ?? "?"}` : "—",
      v.pulse ?? "—", v.temperatureC ?? "—", v.respRate ?? "—", v.spo2 ?? "—",
      v.heightCm ?? "—", v.weightKg ?? "—", v.bmi ?? "—",
    ].map(String))
  );
  const vObs = (code: string, name: string, value: any, unit: string) =>
    value == null ? "" : `
            <component><observation classCode="OBS" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.27" extension="2014-06-09"/>
              <code code="${code}" codeSystem="${OID.loinc}" displayName="${esc(name)}"/>
              <statusCode code="completed"/>
              <value xsi:type="PQ" value="${esc(value)}" unit="${esc(unit)}"/>
            </observation></component>`;
  const vitalEntries = vitals.map((v: any) => `
      <entry typeCode="DRIV">
        <organizer classCode="CLUSTER" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.26" extension="2015-08-01"/>
          <code code="46680005" codeSystem="${OID.snomed}" displayName="Vital signs"/>
          <statusCode code="completed"/>
          <effectiveTime value="${ts(v.takenAt)}"/>
          ${vObs("8480-6", "Systolic BP", v.systolic, "mm[Hg]")}
          ${vObs("8462-4", "Diastolic BP", v.diastolic, "mm[Hg]")}
          ${vObs("8867-4", "Heart rate", v.pulse, "/min")}
          ${vObs("8310-5", "Body temperature", v.temperatureC, "Cel")}
          ${vObs("9279-1", "Respiratory rate", v.respRate, "/min")}
          ${vObs("59408-5", "Oxygen saturation", v.spo2, "%")}
          ${vObs("8302-2", "Body height", v.heightCm, "cm")}
          ${vObs("29463-7", "Body weight", v.weightKg, "kg")}
          ${vObs("39156-5", "BMI", v.bmi, "kg/m2")}
        </organizer>
      </entry>`).join("");

  // Immunizations (11369-6)
  const imms = patient.immunizations || [];
  const immText = narrativeTable(
    ["Vaccine", "CVX", "Date", "Lot", "Site"],
    imms.map((i: any) => [i.vaccine, i.cvxCode || "—", tsDay(i.givenAt) || "—", i.lot || "—", i.site || "—"])
  );
  const immEntries = imms.map((i: any) => `
      <entry typeCode="DRIV">
        <substanceAdministration classCode="SBADM" moodCode="EVN" negationInd="false">
          <templateId root="2.16.840.1.113883.10.20.22.4.52" extension="2015-08-01"/>
          <statusCode code="completed"/>
          <effectiveTime value="${ts(i.givenAt)}"/>
          <consumable>
            <manufacturedProduct classCode="MANU">
              <templateId root="2.16.840.1.113883.10.20.22.4.54" extension="2014-06-09"/>
              <manufacturedMaterial>
                <code ${i.cvxCode ? `code="${esc(i.cvxCode)}" codeSystem="${OID.cvx}" codeSystemName="CVX"` : ""} displayName="${esc(i.vaccine)}"><originalText>${esc(i.vaccine)}</originalText></code>
                ${i.lot ? `<lotNumberText>${esc(i.lot)}</lotNumberText>` : ""}
              </manufacturedMaterial>
            </manufacturedProduct>
          </consumable>
        </substanceAdministration>
      </entry>`).join("");

  // Encounters (46240-8) — narrative only
  const encs = patient.encounters || [];
  const encText = narrativeTable(
    ["Date", "Type", "Provider", "Reason"],
    encs.map((e: any) => [tsDay(e.startedAt) || "—", e.encounterTypeName || e.visitType || "Visit", providerName(e.providerId) || "—", e.chiefComplaint || "—"])
  );

  const section = (tpl: string, ext: string, code: string, title: string, text: string, entries = "") => `
    <component>
      <section>
        <templateId root="${tpl}" extension="${ext}"/>
        <code code="${code}" codeSystem="${OID.loinc}" displayName="${esc(title)}"/>
        <title>${esc(title)}</title>
        ${text}
        ${entries}
      </section>
    </component>`;

  const addr = patient.addressLine1 || patient.city
    ? `<addr use="HP"><streetAddressLine>${esc(patient.addressLine1 || "")}</streetAddressLine><city>${esc(patient.city || "")}</city><state>${esc(patient.state || "")}</state><postalCode>${esc(patient.postalCode || "")}</postalCode><country>US</country></addr>`
    : `<addr nullFlavor="UNK"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="${OID.usHeader}" extension="2015-08-01"/>
  <templateId root="${OID.ccdDoc}" extension="2015-08-01"/>
  <id root="${OID.clinicRoot}" extension="doc-${esc(patient.id)}"/>
  <code code="34133-9" codeSystem="${OID.loinc}" displayName="Summarization of Episode Note"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="${now}"/>
  <confidentialityCode code="N" codeSystem="${OID.confidentiality}"/>
  <languageCode code="en-US"/>
  <recordTarget>
    <patientRole>
      <id root="${OID.clinicRoot}" extension="${esc(patient.mrn)}"/>
      ${addr}
      ${patient.phone ? `<telecom use="HP" value="tel:${esc(patient.phone)}"/>` : `<telecom nullFlavor="UNK"/>`}
      <patient>
        <name use="L"><given>${esc(patient.firstName)}</given><family>${esc(patient.lastName)}</family></name>
        <administrativeGenderCode code="${g.code}" codeSystem="${OID.adminGender}" displayName="${g.name}"/>
        <birthTime value="${tsDay(patient.dob) || ""}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author>
    <time value="${now}"/>
    <assignedAuthor>
      <id root="${OID.clinicRoot}"/>
      <representedOrganization><name>${esc(CLINIC.name)}</name><telecom value="tel:${esc(CLINIC.phone)}"/></representedOrganization>
    </assignedAuthor>
  </author>
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="${OID.clinicRoot}"/>
        <name>${esc(CLINIC.name)}</name>
        <telecom value="tel:${esc(CLINIC.phone)}"/>
        <addr use="WP"><streetAddressLine>${esc(CLINIC.addr1)}</streetAddressLine><city>San Antonio</city><state>TX</state><postalCode>78250</postalCode><country>US</country></addr>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <component>
    <structuredBody>
      ${section("2.16.840.1.113883.10.20.22.2.6.1", "2015-08-01", "48765-2", "Allergies, Adverse Reactions, Alerts", allergyText, allergyEntries)}
      ${section("2.16.840.1.113883.10.20.22.2.1.1", "2014-06-09", "10160-0", "Medications", medText, medEntries)}
      ${section("2.16.840.1.113883.10.20.22.2.5.1", "2015-08-01", "11450-4", "Problems", probText, probEntries)}
      ${section("2.16.840.1.113883.10.20.22.2.4.1", "2015-08-01", "8716-3", "Vital Signs", vitalText, vitalEntries)}
      ${section("2.16.840.1.113883.10.20.22.2.2.1", "2015-08-01", "11369-6", "Immunizations", immText, immEntries)}
      ${section("2.16.840.1.113883.10.20.22.2.22.1", "2015-08-01", "46240-8", "Encounters", encText)}
    </structuredBody>
  </component>
</ClinicalDocument>`;
}
