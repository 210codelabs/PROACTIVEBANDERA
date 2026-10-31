// Cleanup script for QA test data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up QA test data...');
  
  try {
    // Delete AppointmentRequest records where lastName starts with 'Loc' or is 'NoLoc' or 'LateTime' and firstName is 'QA'
    const deletedRequests = await prisma.appointmentRequest.deleteMany({
      where: {
        firstName: 'QA',
        OR: [
          { lastName: { startsWith: 'Loc' } },
          { lastName: 'NoLoc' },
          { lastName: 'LateTime' }
        ]
      }
    });
    
    console.log(`✅ Deleted ${deletedRequests.count} AppointmentRequest records`);
    
    // Delete Message records with subject containing QA confirmation numbers or names
    const deletedMessages = await prisma.message.deleteMany({
      where: {
        OR: [
          { subject: { contains: 'QA Loc' } },
          { subject: { contains: 'QA NoLoc' } },
          { subject: { contains: 'QA LateTime' } }
        ]
      }
    });
    
    console.log(`✅ Deleted ${deletedMessages.count} Message records`);
    
    console.log('✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
