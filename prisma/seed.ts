import { PrismaClient, CampaignStatus, PledgeStatus, WaitlistStatus, Courier, DeliveryStatus, OrphanStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning existing database data...');
  // Delete in reverse order of dependencies to avoid foreign key violations
  await prisma.orphanInventory.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.pledge.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.tier.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.trustLog.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding 5 Users...');
  const user1 = await prisma.user.create({
    data: {
      phoneNumber: '+8801700000001',
      currentTrust: 100,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      phoneNumber: '+8801700000002',
      currentTrust: 95,
      trustLogs: {
        create: {
          deltaScore: -5,
          newTotalScore: 95,
          reason: 'Missed payment checkout window by 2 hours',
        },
      },
    },
  });

  const user3 = await prisma.user.create({
    data: {
      phoneNumber: '+8801700000003',
      currentTrust: 100,
    },
  });

  const user4 = await prisma.user.create({
    data: {
      phoneNumber: '+8801700000004',
      currentTrust: 100,
    },
  });

  const user5 = await prisma.user.create({
    data: {
      phoneNumber: '+8801700000005',
      currentTrust: 50,
      trustLogs: {
        create: {
          deltaScore: -50,
          newTotalScore: 50,
          reason: 'Rejected Cash on Delivery order at door without valid reason',
        },
      },
    },
  });

  console.log('Seeding 1 Campaign with 3 Tiers...');
  const campaign = await prisma.campaign.create({
    data: {
      title: 'Premium Mechanical Keyboard - Group Buy',
      basePrice: 150.00,
      targetVolume: 100,
      startTime: new Date(),
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      status: CampaignStatus.ACTIVE,
      tiers: {
        createMany: {
          data: [
            { targetVolume: 20, unlockedPrice: 135.00, isUnlocked: true },
            { targetVolume: 50, unlockedPrice: 120.00, isUnlocked: false },
            { targetVolume: 100, unlockedPrice: 100.00, isUnlocked: false },
          ],
        },
      },
    },
  });

  console.log('Seeding Pledges and Waitlist Entries...');
  // User 1 makes a confirmed pledge
  const pledge1 = await prisma.pledge.create({
    data: {
      userId: user1.id,
      campaignId: campaign.id,
      lockedPrice: 150.00,
      finalPrice: null,
      tokenAdvancePaid: 15.00,
      codAmountDue: 135.00,
      status: PledgeStatus.CONFIRMED,
    },
  });

  // User 2 makes a pending payment pledge with an expiration window
  await prisma.pledge.create({
    data: {
      userId: user2.id,
      campaignId: campaign.id,
      lockedPrice: 135.00,
      finalPrice: null,
      tokenAdvancePaid: 15.00,
      codAmountDue: 120.00,
      status: PledgeStatus.PENDING_PAYMENT,
      checkoutWindowExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days window
    },
  });

  // User 3 makes a pledge that gets confirmed and dispatched for delivery
  const pledge3 = await prisma.pledge.create({
    data: {
      userId: user3.id,
      campaignId: campaign.id,
      lockedPrice: 135.00,
      finalPrice: null,
      tokenAdvancePaid: 15.00,
      codAmountDue: 120.00,
      status: PledgeStatus.CONFIRMED,
    },
  });

  console.log('Seeding Delivery...');
  await prisma.delivery.create({
    data: {
      pledgeId: pledge3.id,
      courier: Courier.PATHAO,
      trackingId: 'PTH-99887766',
      status: DeliveryStatus.PENDING,
      codAmount: 120.00,
    },
  });

  // User 4 is waitlisted
  await prisma.waitlistEntry.create({
    data: {
      userId: user4.id,
      campaignId: campaign.id,
      status: WaitlistStatus.WAITING,
    },
  });

  // User 5 made a pledge that got rejected at door, leading to an orphan inventory item
  const pledge5 = await prisma.pledge.create({
    data: {
      userId: user5.id,
      campaignId: campaign.id,
      lockedPrice: 150.00,
      finalPrice: null,
      tokenAdvancePaid: 15.00,
      codAmountDue: 135.00,
      status: PledgeStatus.REJECTED_AT_DOOR,
    },
  });

  console.log('Seeding Orphan Inventory...');
  await prisma.orphanInventory.create({
    data: {
      campaignId: campaign.id,
      pledgeId: pledge5.id,
      status: OrphanStatus.PENDING_INSPECTION,
    },
  });

  console.log('Adding database constraint for currentTrust...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" DROP CONSTRAINT IF EXISTS check_trust_non_negative;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD CONSTRAINT check_trust_non_negative CHECK ("currentTrust" >= 0);
  `);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
