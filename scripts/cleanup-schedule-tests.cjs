const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const testFirst = ["Test", "Convert", "Convert2", "NoTime", "Jane"];
  const testLast = ["Visitor", "Tester", "Tester2", "Req", "Doe"];

  // Appointment requests created during testing
  const reqs = await db.appointmentRequest.findMany();
  let delReq = 0;
  for (const r of reqs) {
    if (testFirst.includes(r.firstName) && testLast.includes(r.lastName)) {
      // delete linked appointment if any
      if (r.appointmentId) {
        try { await db.appointment.delete({ where: { id: r.appointmentId } }); } catch {}
      }
      await db.appointmentRequest.delete({ where: { id: r.id } });
      delReq++;
    }
  }

  // Patients created by convert (test names)
  const pats = await db.patient.findMany({ where: { OR: [
    { firstName: "Convert", lastName: "Tester" },
    { firstName: "Convert2", lastName: "Tester2" },
  ] } });
  let delPat = 0;
  for (const p of pats) {
    try { await db.appointment.deleteMany({ where: { patientId: p.id } }); } catch {}
    try { await db.patient.delete({ where: { id: p.id } }); delPat++; } catch (e) { console.log("skip patient", p.mrn, e.message); }
  }

  console.log(`Deleted ${delReq} test requests, ${delPat} test patients.`);
}
main().finally(() => db.$disconnect());
