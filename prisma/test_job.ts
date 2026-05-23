import { PrismaClient } from '@prisma/client';
import { schedulePaymentWindow } from '../src/queues/pledgeExpirationQueue.js';

const prisma = new PrismaClient();

async function test() {
  console.log('🔍 Fetching seeded user (User 2) and their pending payment pledge...');
  const user = await prisma.user.findFirst({
    where: { phoneNumber: '+8801700000002' }
  });
  
  if (!user) {
    console.error('❌ User 2 not found.');
    process.exit(1);
  }

  const pledge = await prisma.pledge.findFirst({
    where: { userId: user.id, status: 'PENDING_PAYMENT' }
  });

  if (!pledge) {
    console.error('❌ Pending payment pledge for User 2 not found.');
    process.exit(1);
  }

  console.log(`✅ Found Pledge: ${pledge.id} for User: ${user.id} in state PENDING_PAYMENT.`);
  console.log(`Trust score before expiration: ${user.currentTrust}`);

  // Schedule the job with 500ms delay
  console.log('🚀 Scheduling expiration job with 500ms delay...');
  await schedulePaymentWindow(pledge.id, user.id, 500);

  // Wait 3 seconds for the job to be picked up and processed by the worker
  console.log('⏳ Waiting 3 seconds for worker to process job...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verify the updates in the database
  console.log('\n📊 Checking database state after job execution...');
  
  const updatedPledge = await prisma.pledge.findUnique({
    where: { id: pledge.id }
  });
  console.log(`Pledge Status: ${updatedPledge?.status} (Expected: DEFAULTED)`);

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id }
  });
  console.log(`User Trust Score: ${updatedUser?.currentTrust} (Expected: 65, defaulted from 95)`);

  const trustLogs = await prisma.trustLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Trust logs count: ${trustLogs.length}`);
  for (const log of trustLogs) {
    console.log(`  - Delta: ${log.deltaScore}, Total: ${log.newTotalScore}, Reason: ${log.reason}`);
  }

  // Check waitlist promotions!
  console.log('\n📊 Checking waitlist promotions...');
  const promotedUser = await prisma.user.findFirst({
    where: { phoneNumber: '+8801700000004' } // User 4 was waitlisted
  });

  if (promotedUser) {
    const waitlistEntry = await prisma.waitlistEntry.findFirst({
      where: { userId: promotedUser.id }
    });
    console.log(`Waitlist Entry Status: ${waitlistEntry?.status} (Expected: PROMOTED)`);

    const newPledge = await prisma.pledge.findFirst({
      where: { userId: promotedUser.id, status: 'PENDING_PAYMENT' }
    });
    console.log(`New Pledge Created: ${newPledge ? 'Yes' : 'No'} (Expected: Yes)`);
    if (newPledge) {
      console.log(`  - Status: ${newPledge.status}`);
      console.log(`  - Locked Price: ${newPledge.lockedPrice}`);
      console.log(`  - Checkout Window Expires At: ${newPledge.checkoutWindowExpiresAt}`);
    }
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
