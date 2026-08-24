import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }

function mrn() { return `PC-${Math.floor(100000 + Math.random() * 900000)}`; }
async function ensurePatient(first: string, last: string, dob: string, email: string) {
  let m = mrn(); let g = 0;
  while (await db.patient.findFirst({ where: { mrn: m }, select: { id: true } })) { m = mrn(); if (++g > 8) break; }
  return db.patient.create({ data: { mrn: m, firstName: first, lastName: last, dob: new Date(dob), sex: "X", email, patientType: "clinical", status: "active" } });
}

const COMPANIES = [
  {
    companyName: "Lone Star Logistics", industry: "Transportation / Trucking", contactName: "Maria Delgado",
    contactEmail: "hr@lonestarlogistics.com", contactPhone: "(210) 555-2201", city: "San Antonio", state: "TX",
    billingEmail: "ap@lonestarlogistics.com", netTerms: 30,
    admin: { email: "hr@lonestarlogistics.com", password: "demo1234", firstName: "Maria", lastName: "Delgado", title: "HR Director" },
    employees: [
      { first: "Carlos", last: "Rivera", dob: "1988-04-12", email: "carlos.r@lonestar.com", serviceKey: "dot_physical", serviceLabel: "DOT Physical Exam", status: "completed", result: "pass", summary: "Certified 24 months", consent: "Carlos Rivera" },
      { first: "Denise", last: "Wong", dob: "1992-09-03", email: "denise.w@lonestar.com", serviceKey: "drug_dot", serviceLabel: "DOT Drug & Alcohol Test", status: "in_progress", result: "pending", summary: "", consent: "Denise Wong" },
    ],
    invoice: { number: "INV-2026-1001", status: "sent", lineItems: [{ desc: "DOT Physical Exam", qty: 1, unitCents: 9500 }, { desc: "DOT Drug & Alcohol Test", qty: 1, unitCents: 7500 }] },
  },
  {
    companyName: "Alamo Manufacturing Co.", industry: "Manufacturing", contactName: "Greg Halloran",
    contactEmail: "safety@alamomfg.com", contactPhone: "(210) 555-8890", city: "San Antonio", state: "TX",
    billingEmail: "billing@alamomfg.com", netTerms: 45,
    admin: { email: "safety@alamomfg.com", password: "demo1234", firstName: "Greg", lastName: "Halloran", title: "Safety Manager" },
    employees: [
      { first: "Aisha", last: "Nkemelu", dob: "1990-06-18", email: "aisha.n@alamomfg.com", serviceKey: "respirator_fit", serviceLabel: "Respirator Fit Test", status: "scheduled", result: "pending", summary: "", consent: "Aisha Nkemelu" },
      { first: "Sergio", last: "Pena", dob: "1979-11-30", email: "sergio.p@alamomfg.com", serviceKey: "audiometry", serviceLabel: "Audiometry / Hearing Test", status: "completed", result: "pass", summary: "No threshold shift", consent: "Sergio Pena" },
    ],
    invoice: { number: "INV-2026-1002", status: "paid", lineItems: [{ desc: "Respirator Fit Test", qty: 4, unitCents: 6000 }, { desc: "Audiometry", qty: 4, unitCents: 5000 }] },
  },
];

// Idempotent: safe to run in production. Creates missing demo companies and
// ALWAYS (re)sets the demo portal-user password so the demo logins work.
export async function POST() {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const results: any[] = [];
  const hash = await bcrypt.hash("demo1234", 10);

  for (const c of COMPANIES) {
    let acct = await db.enterpriseAccount.findFirst({ where: { companyName: c.companyName } });
    let accountCreated = false;
    if (!acct) {
      acct = await db.enterpriseAccount.create({ data: { companyName: c.companyName, industry: c.industry, contactName: c.contactName, contactEmail: c.contactEmail, contactPhone: c.contactPhone, city: c.city, state: c.state, billingEmail: c.billingEmail, netTerms: c.netTerms } });
      accountCreated = true;
    }

    const email = c.admin.email.toLowerCase();
    const existingUser = await db.enterprisePortalUser.findUnique({ where: { email } });
    let userAction = "";
    if (existingUser) {
      await db.enterprisePortalUser.update({ where: { email }, data: { passwordHash: hash, active: true, enterpriseId: acct.id } });
      userAction = "password reset";
    } else {
      await db.enterprisePortalUser.create({ data: { enterpriseId: acct.id, email, passwordHash: hash, firstName: c.admin.firstName, lastName: c.admin.lastName, title: c.admin.title } });
      userAction = "created";
    }

    // Only seed demo content when the account is brand new (avoid duplicates).
    if (accountCreated) {
      for (const e of c.employees) {
        const p = await ensurePatient(e.first, e.last, e.dob, e.email);
        await db.enterpriseServiceRequest.create({ data: {
          enterpriseId: acct.id, patientId: p.id, employeeFirstName: e.first, employeeLastName: e.last, employeeDob: new Date(e.dob), employeeEmail: e.email,
          serviceKey: e.serviceKey, serviceLabel: e.serviceLabel, status: e.status, resultStatus: e.result, resultSummary: e.summary || null,
          consentStatus: e.consent ? "signed" : "pending", consentEmployer: `${c.admin.firstName} ${c.admin.lastName}`, consentEmployee: e.consent || null, consentSignedAt: e.consent ? new Date() : null, createdByName: `${c.admin.firstName} ${c.admin.lastName}`,
        } });
        await db.enterpriseEmployee.create({ data: { enterpriseId: acct.id, patientId: p.id, firstName: e.first, lastName: e.last, dob: new Date(e.dob), email: e.email, createdByName: `${c.admin.firstName} ${c.admin.lastName}` } }).catch(() => {});
      }
      await db.enterpriseMessage.create({ data: { enterpriseId: acct.id, senderType: "clinic", senderName: "ProactiveClinics", body: `Welcome ${c.companyName}! Submit occupational-health requests here and we'll notify you as results are ready.` } });
      const subtotal = c.invoice.lineItems.reduce((s, l) => s + l.qty * l.unitCents, 0);
      await db.enterpriseInvoice.create({ data: { enterpriseId: acct.id, number: c.invoice.number, status: c.invoice.status, dueDate: new Date(Date.now() + c.netTerms * 86400000), lineItems: c.invoice.lineItems, subtotalCents: subtotal, taxCents: 0, totalCents: subtotal, paidAt: c.invoice.status === "paid" ? new Date() : null } });
    }

    results.push({ company: c.companyName, account: accountCreated ? "created" : "existed", login: email, password: "demo1234", user: userAction });
  }

  return NextResponse.json({ ok: true, results, note: "Demo enterprise logins are ready. Password for both is demo1234." });
}
