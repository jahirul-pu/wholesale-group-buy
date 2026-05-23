import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('🔍 Fetching seeded campaign and user from database...');
  const campaign = await prisma.campaign.findFirst({
    where: { title: 'Premium Mechanical Keyboard - Group Buy' }
  });

  if (!campaign) {
    console.error('❌ Seeded campaign not found. Please seed the database first.');
    process.exit(1);
  }

  console.log(`🚀 Sending Dispatch Request for Campaign ID: ${campaign.id} with courier: PATHAO`);
  
  // Call the active local server endpoint
  const response = await fetch(`http://127.0.0.1:3000/api/campaigns/${campaign.id}/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ courier: 'PATHAO' })
  });

  const body = (await response.json()) as any;
  console.log('📥 Response Status:', response.status);
  console.log('📥 Response Body:', JSON.stringify(body, null, 2));

  // Verify the DB updates
  console.log('\n📊 Checking database records after dispatch request...');
  const deliveries = await prisma.delivery.findMany({
    include: {
      pledge: {
        include: {
          user: true
        }
      }
    }
  });

  console.log(`Total deliveries in database: ${deliveries.length}`);
  for (const d of deliveries) {
    console.log(`Delivery ID: ${d.id}`);
    console.log(`  - Courier: ${d.courier}`);
    console.log(`  - Tracking ID: ${d.trackingId}`);
    console.log(`  - COD Amount: ${d.codAmount}`);
    console.log(`  - Pledge Status: ${d.pledge.status}`);
    console.log(`  - User Phone: ${d.pledge.user.phoneNumber}`);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
