import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const secret = 'super-secret-webhook-key';

async function test() {
  console.log('🔍 Fetching seeded delivery and campaign...');
  const delivery = await prisma.delivery.findFirst({
    where: { trackingId: 'PTH-99887766' },
    include: {
      pledge: {
        include: {
          user: true
        }
      }
    }
  });

  if (!delivery) {
    console.error('❌ Seeded delivery PTH-99887766 not found. Please seed the database first.');
    process.exit(1);
  }

  const user3Id = delivery.pledge.userId;
  console.log(`✅ Found Seeded Delivery. Tracking: ${delivery.trackingId}, User currentTrust: ${delivery.pledge.user.currentTrust}`);

  // Test 1: Signature Verification - Missing Header
  console.log('\n🔐 Test 1: Webhook Signature Verification - Missing Header');
  let res = await fetch('http://127.0.0.1:3000/api/webhooks/courier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingId: 'PTH-99887766', status: 'RETURNED' }),
  });
  console.log(`   Response Status: ${res.status} (Expected: 401)`);
  let resBody = await res.json() as any;
  console.log(`   Response Body:`, resBody);

  // Test 2: Signature Verification - Invalid Signature
  console.log('\n🔐 Test 2: Webhook Signature Verification - Invalid Signature');
  res = await fetch('http://127.0.0.1:3000/api/webhooks/courier', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-courier-signature': 'invalid-sig-here'
    },
    body: JSON.stringify({ trackingId: 'PTH-99887766', status: 'RETURNED' }),
  });
  console.log(`   Response Status: ${res.status} (Expected: 401)`);

  // Test 3: Signature Verification - Valid HMAC-SHA256 Signature
  console.log('\n🔐 Test 3: Webhook Signature Verification - Valid HMAC-SHA256');
  const webhookBody = { trackingId: 'PTH-99887766', status: 'RETURNED' };
  const hmacSig = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(webhookBody))
    .digest('hex');

  res = await fetch('http://127.0.0.1:3000/api/webhooks/courier', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-courier-signature': hmacSig
    },
    body: JSON.stringify(webhookBody),
  });
  console.log(`   Response Status: ${res.status} (Expected: 200)`);
  resBody = await res.json() as any;
  console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

  // Verify the DB state updates
  console.log('\n📊 Verifying DB updates after failed webhook processing...');
  
  const updatedDelivery = await prisma.delivery.findUnique({
    where: { id: delivery.id }
  });
  console.log(`   Delivery Status: ${updatedDelivery?.status} (Expected: RETURNED)`);

  const updatedPledge = await prisma.pledge.findUnique({
    where: { id: delivery.pledgeId }
  });
  console.log(`   Pledge Status: ${updatedPledge?.status} (Expected: REJECTED_AT_DOOR)`);

  const updatedUser = await prisma.user.findUnique({
    where: { id: user3Id }
  });
  console.log(`   User Trust Score: ${updatedUser?.currentTrust} (Expected: 50, started at 100)`);

  const trustLogs = await prisma.trustLog.findMany({
    where: { userId: user3Id },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`   Trust Logs created: ${trustLogs.length}`);
  if (trustLogs.length > 0) {
    console.log(`     - Delta: ${trustLogs[0].deltaScore}`);
    console.log(`     - New Total: ${trustLogs[0].newTotalScore}`);
    console.log(`     - Reason: "${trustLogs[0].reason}"`);
  }

  const orphan = await prisma.orphanInventory.findUnique({
    where: { pledgeId: delivery.pledgeId }
  });
  console.log(`   Orphan Inventory Created: ${orphan ? 'Yes' : 'No'} (Expected: Yes)`);
  console.log(`   Orphan Inventory Status: ${orphan?.status} (Expected: PENDING_INSPECTION)`);

  // Test 4: Database CHECK constraint validation (prevent trust falling below 0)
  console.log('\n🛡️ Test 4: Database CHECK constraint validation (direct update constraint)');
  try {
    await prisma.user.update({
      where: { id: user3Id },
      data: { currentTrust: -10 }
    });
    console.error('   ❌ ERROR: Database CHECK constraint did not prevent negative trust score!');
  } catch (err: any) {
    console.log('   ✅ SUCCESS: Database CHECK constraint successfully prevented negative trust score.');
    console.log(`   Error message detail: ${err.message.split('\n').pop()}`);
  }

  // Test 5: Warehouse Ingest RESTOCK
  if (orphan) {
    console.log('\n📦 Test 5: Warehouse Ingest RESTOCK');
    res = await fetch('http://127.0.0.1:3000/api/warehouse/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orphanInventoryId: orphan.id,
        action: 'RESTOCK'
      })
    });
    console.log(`   Response Status: ${res.status} (Expected: 200)`);
    resBody = await res.json() as any;
    console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

    const restockedOrphan = await prisma.orphanInventory.findUnique({
      where: { id: orphan.id }
    });
    console.log(`   Orphan Inventory status in DB: ${restockedOrphan?.status} (Expected: FLASH_STOCK)`);
  }

  // Test 6: Warehouse Ingest DAMAGED
  console.log('\n📦 Test 6: Warehouse Ingest DAMAGED');
  // Fetch User 5's seeded orphan inventory
  const seededOrphan = await prisma.orphanInventory.findFirst({
    where: {
      pledge: {
        user: { phoneNumber: '+8801700000005' }
      }
    }
  });

  if (seededOrphan) {
    res = await fetch('http://127.0.0.1:3000/api/warehouse/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orphanInventoryId: seededOrphan.id,
        action: 'DAMAGED'
      })
    });
    console.log(`   Response Status: ${res.status} (Expected: 200)`);
    resBody = await res.json() as any;
    console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

    const inspectedOrphan = await prisma.orphanInventory.findUnique({
      where: { id: seededOrphan.id }
    });
    console.log(`   Orphan Inventory status in DB: ${inspectedOrphan?.status} (Expected: PENDING_INSPECTION)`);
  } else {
    console.error('   ❌ User 5 seeded orphan inventory not found');
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
