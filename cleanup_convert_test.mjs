import { db } from './src/lib/db.ts';

async function cleanup() {
  console.log('Starting cleanup...');
  
  // Delete appointments
  const appointmentIds = ['cmsbyrazm0008369k9vvnnudt', 'cmsbyrc3a000c369kzph12lce'];
  for (const id of appointmentIds) {
    try {
      await db.appointment.delete({ where: { id } });
      console.log(`Deleted appointment: ${id}`);
    } catch (e) {
      console.log(`Failed to delete appointment ${id}:`, e.message);
    }
  }
  
  // Delete appointment requests
  const requestIds = ['cmsbyrama0005369k486sqnlr', 'cmsbyrbcs0009369kzonqmqtw', 'cmsbyrbts000a369kr9lf70rn'];
  for (const id of requestIds) {
    try {
      await db.appointmentRequest.delete({ where: { id } });
      console.log(`Deleted appointment request: ${id}`);
    } catch (e) {
      console.log(`Failed to delete request ${id}:`, e.message);
    }
  }
  
  // Delete patients (only test patients named 'ZZTest Convert' or 'ZZNoTime Convert')
  const patientIds = ['cmsbyrazi0006369k2gjjvv9r'];
  for (const id of patientIds) {
    try {
      const patient = await db.patient.findUnique({ where: { id } });
      if (patient && (patient.firstName === 'ZZTest' || patient.firstName === 'ZZNoTime') && patient.lastName === 'Convert') {
        await db.patient.delete({ where: { id } });
        console.log(`Deleted patient: ${id} (${patient.firstName} ${patient.lastName})`);
      } else {
        console.log(`Skipped patient ${id} (not a test patient)`);
      }
    } catch (e) {
      console.log(`Failed to delete patient ${id}:`, e.message);
    }
  }
  
  console.log('Cleanup complete.');
}

cleanup().catch(console.error).finally(() => process.exit(0));
