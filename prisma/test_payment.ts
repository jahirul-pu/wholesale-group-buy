import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('🔍 Fetching user (User 2) and their pending payment pledge...');
  const user = await prisma.user.findFirst({
    where: { phoneNumber: '+8801700000002' },
    include: {
      pledges: {
        where: { status: 'PENDING_PAYMENT' }
      }
    }
  });

  if (!user || user.pledges.length === 0) {
    console.error('❌ User 2 pending payment pledge not found. Please seed the database first.');
    process.exit(1);
  }

  const pledge = user.pledges[0];
  console.log(`✅ Found Pledge: ${pledge.id} in state ${pledge.status}. Locked price: ${pledge.lockedPrice}`);

  // Test 1: Initiate Checkout (bKash, TOKEN_ADVANCE)
  console.log('\n💳 Test 1: Initiate Checkout via POST /api/checkout/initiate (bKash, TOKEN_ADVANCE)...');
  let res = await fetch('http://127.0.0.1:3000/api/checkout/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pledgeId: pledge.id,
      paymentType: 'TOKEN_ADVANCE',
      gateway: 'BKASH',
    }),
  });

  console.log(`   Response Status: ${res.status} (Expected: 200)`);
  let resBody = (await res.json()) as any;
  console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

  if (!resBody.success) {
    console.error('❌ Failed to initiate checkout');
    process.exit(1);
  }

  const transactionId1 = resBody.data.transactionId;
  const expectedAmount1 = resBody.data.amount;
  console.log(`   Generated Txn ID: ${transactionId1}, Expected Amount: ${expectedAmount1} (50% of ${pledge.lockedPrice})`);

  // Verify transaction in DB is PENDING
  const tx1 = await prisma.transaction.findUnique({ where: { transactionId: transactionId1 } });
  console.log(`   DB Transaction Status: ${tx1?.status} (Expected: PENDING)`);

  // Test 2: Process Webhook Callback (bKash Success) via POST /api/webhooks/payment
  console.log('\n📬 Test 2: Process Webhook Callback (bKash Success) via POST /api/webhooks/payment...');
  res = await fetch(`http://127.0.0.1:3000/api/webhooks/payment?status=success&paymentID=BKASH-PAY-${transactionId1}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log(`   Response Status: ${res.status} (Expected: 200)`);
  resBody = (await res.json()) as any;
  console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

  // Verify the DB state updates
  console.log('\n📊 Verifying DB updates after successful payment processing...');
  const updatedTx1 = await prisma.transaction.findUnique({ where: { transactionId: transactionId1 } });
  console.log(`   Transaction Status in DB: ${updatedTx1?.status} (Expected: SUCCESS)`);

  const updatedPledge = await prisma.pledge.findUnique({ where: { id: pledge.id } });
  console.log(`   Pledge Status: ${updatedPledge?.status} (Expected: CONFIRMED)`);
  console.log(`   Pledge Amount Paid: ${updatedPledge?.amountPaid} (Expected: ${expectedAmount1})`);
  console.log(`   Pledge COD Balance: ${updatedPledge?.codBalance} (Expected: ${Number(pledge.lockedPrice) - expectedAmount1})`);
  console.log(`   Checkout Window Expires At: ${updatedPledge?.checkoutWindowExpiresAt} (Expected: null)`);

  // Test 3: Idempotency Protection
  console.log('\n🛡️ Test 3: Verify Webhook Idempotency (calling webhook again for same transactionId)...');
  res = await fetch(`http://127.0.0.1:3000/api/webhooks/payment?status=success&paymentID=BKASH-PAY-${transactionId1}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log(`   Response Status: ${res.status} (Expected: 200)`);
  resBody = (await res.json()) as any;
  console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

  // Verify no additional amount is paid (amountPaid remains same)
  const finalPledge = await prisma.pledge.findUnique({ where: { id: pledge.id } });
  console.log(`   Pledge Amount Paid after duplicate IPN: ${finalPledge?.amountPaid} (Expected: ${expectedAmount1})`);

  // Test 4: SSLCommerz full payment flow
  console.log('\n💳 Test 4: Initiate another checkout for a new pledge (SSLCommerz, FULL_PAYMENT)...');
  // Transition User 3's pledge to PENDING_PAYMENT for this test
  const user3 = await prisma.user.findFirst({
    where: { phoneNumber: '+8801700000003' },
    include: { pledges: true }
  });
  const user3Pledge = user3!.pledges[0];
  await prisma.pledge.update({
    where: { id: user3Pledge.id },
    data: { status: 'PENDING_PAYMENT' }
  });

  res = await fetch('http://127.0.0.1:3000/api/checkout/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pledgeId: user3Pledge.id,
      paymentType: 'FULL_PAYMENT',
      gateway: 'SSLCOMMERZ',
    }),
  });

  console.log(`   Response Status: ${res.status} (Expected: 200)`);
  resBody = (await res.json()) as any;
  console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

  const transactionId2 = resBody.data.transactionId;
  const expectedAmount2 = resBody.data.amount;
  console.log(`   Generated Txn ID: ${transactionId2}, Expected Amount: ${expectedAmount2} (100% of ${user3Pledge.lockedPrice})`);

  // Call webhook for SSLCommerz
  console.log('\n📬 Test 5: Process Webhook Callback (SSLCommerz Success) via POST...');
  res = await fetch(`http://127.0.0.1:3000/api/webhooks/payment?status=success&tran_id=${transactionId2}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log(`   Response Status: ${res.status} (Expected: 200)`);
  resBody = (await res.json()) as any;
  console.log(`   Response Body:`, JSON.stringify(resBody, null, 2));

  const updatedPledge3 = await prisma.pledge.findUnique({ where: { id: user3Pledge.id } });
  console.log(`   User 3 Pledge Status: ${updatedPledge3?.status} (Expected: CONFIRMED)`);
  console.log(`   User 3 Amount Paid: ${updatedPledge3?.amountPaid} (Expected: ${expectedAmount2})`);
  console.log(`   User 3 COD Balance: ${updatedPledge3?.codBalance} (Expected: 0)`);
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
