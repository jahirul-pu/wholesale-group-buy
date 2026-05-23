import { Prisma, PledgeStatus, WaitlistStatus } from '@prisma/client';
import { schedulePaymentWindow } from '../queues/pledgeExpirationQueue.js';

export interface WaitlistPromotionResult {
  pledgeId: string;
  userId: string;
  delayMs: number;
}

/**
 * Evaluates the waitlist capacity for a campaign and promotes waiting users
 * up to the available target volume.
 * 
 * Runs within a transaction context (`tx`).
 * Returns an array of job promotion items to be scheduled after the tx commits.
 */
export async function processWaitlist(
  campaignId: string,
  tx: Prisma.TransactionClient
): Promise<WaitlistPromotionResult[]> {
  console.log(`📋 Running Waitlist Promotion Engine for campaign: ${campaignId}`);

  // 1. Fetch campaign and current active tiers
  const campaign = await tx.campaign.findUnique({
    where: { id: campaignId },
    include: {
      tiers: {
        orderBy: { targetVolume: 'asc' },
      },
    },
  });

  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }

  // 2. Count CONFIRMED pledges
  const confirmedPledgeCount = await tx.pledge.count({
    where: {
      campaignId,
      status: 'CONFIRMED',
    },
  });

  // 3. Calculate remaining inventory slots
  const availableSlots = campaign.targetVolume - confirmedPledgeCount;
  if (availableSlots <= 0) {
    console.log('ℹ️ No inventory slots available for promotion.');
    return [];
  }

  console.log(`ℹ️ Available inventory slots for promotion: ${availableSlots}`);

  // 4. Query waitlisted users: status WAITING, ordered by user.currentTrust (DESC) then joinedAt (ASC)
  const waitlistEntries = await tx.waitlistEntry.findMany({
    where: {
      campaignId,
      status: 'WAITING',
    },
    orderBy: [
      { user: { currentTrust: 'desc' } },
      { joinedAt: 'asc' },
    ],
    take: availableSlots,
    include: {
      user: true,
    },
  });

  if (waitlistEntries.length === 0) {
    console.log('ℹ️ Waitlist is empty. No users to promote.');
    return [];
  }

  console.log(`ℹ️ Promoting ${waitlistEntries.length} users from waitlist...`);

  // 5. Get active price tier (counting all active/non-failed pledges to find unlocked price)
  const activeCount = await tx.pledge.count({
    where: {
      campaignId,
      status: {
        in: ['PLEDGED', 'PENDING_PAYMENT', 'CONFIRMED'],
      },
    },
  });

  let lockedPrice = campaign.basePrice;
  for (const tier of campaign.tiers) {
    if (tier.isUnlocked || activeCount >= tier.targetVolume) {
      lockedPrice = tier.unlockedPrice;
    }
  }

  const tokenAdvancePaid = new Prisma.Decimal(lockedPrice).mul(0.1);
  const codAmountDue = new Prisma.Decimal(lockedPrice).sub(tokenAdvancePaid);
  const oneHour = 60 * 60 * 1000;
  const checkoutWindowExpiresAt = new Date(Date.now() + oneHour);

  const promotions: WaitlistPromotionResult[] = [];

  for (const entry of waitlistEntries) {
    // Promote waitlist entry
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'PROMOTED' },
    });

    // Create a new Pledge with a 1-hour micro-window
    const newPledge = await tx.pledge.create({
      data: {
        userId: entry.userId,
        campaignId,
        lockedPrice,
        tokenAdvancePaid,
        codAmountDue,
        status: 'PENDING_PAYMENT',
        checkoutWindowExpiresAt,
      },
    });

    promotions.push({
      pledgeId: newPledge.id,
      userId: entry.userId,
      delayMs: oneHour,
    });
  }

  return promotions;
}

/**
 * Helper to schedule promotion expiration jobs after database transaction commits
 */
export async function schedulePromotions(promotions: WaitlistPromotionResult[]) {
  for (const promo of promotions) {
    try {
      console.log(`⏰ Scheduling checkout window expiration job for promoted user ${promo.userId} (Pledge: ${promo.pledgeId})`);
      await schedulePaymentWindow(promo.pledgeId, promo.userId, promo.delayMs);
    } catch (err) {
      console.error(`❌ Failed to schedule expiration job for promoted user ${promo.userId}:`, err);
    }
  }
}
