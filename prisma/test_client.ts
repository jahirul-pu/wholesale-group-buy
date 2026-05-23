import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('🔍 Fetching seeded campaign and user from database...');
  const campaign = await prisma.campaign.findFirst({
    where: { title: 'Premium Mechanical Keyboard - Group Buy' }
  });
  const user = await prisma.user.findFirst({
    where: { phoneNumber: '+8801700000004' } // User 4 is waitlisted and has no pledge yet
  });

  if (!campaign || !user) {
    console.error('❌ Seeded data not found. Please make sure the database is seeded.');
    process.exit(1);
  }

  console.log(`🚀 Sending Pledge Request for Campaign ID: ${campaign.id}, User ID: ${user.id}`);
  
  // Call the active local server endpoint
  const response = await fetch(`http://127.0.0.1:3000/api/campaigns/${campaign.id}/pledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId: user.id })
  });

  const body = (await response.json()) as any;
  console.log('📥 Response Status:', response.status);
  console.log('📥 Response Body:', JSON.stringify(body, null, 2));

  // Verify the DB updates
  console.log('\n📊 Checking database records after request...');
  const pledges = await prisma.pledge.findMany({
    where: { campaignId: campaign.id },
    include: { user: true }
  });
  console.log(`Active pledges in db: ${pledges.length}`);
  for (const p of pledges) {
    console.log(`  - User ${p.user.phoneNumber}: status = ${p.status}, lockedPrice = ${p.lockedPrice}`);
  }
  
  const tiers = await prisma.tier.findMany({
    where: { campaignId: campaign.id },
    orderBy: { targetVolume: 'asc' }
  });
  console.log('\nTiers status in db:');
  for (const tier of tiers) {
     console.log(`  - Volume Target: ${tier.targetVolume}, Price: ${tier.unlockedPrice}, isUnlocked: ${tier.isUnlocked}`);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
