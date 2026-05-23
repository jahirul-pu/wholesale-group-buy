import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import prisma from '../config/prisma.js';
import { processWaitlist, schedulePromotions, WaitlistPromotionResult } from '../services/waitlistService.js';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Dedicated connection for the BullMQ Worker
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  }
});

interface ExpirationJobData {
  pledgeId: string;
  userId: string;
}

const pledgeExpirationWorker = new Worker(
  'pledge-expiration',
  async (job: Job<ExpirationJobData>) => {
    const { pledgeId, userId } = job.data;
    console.log(`⚙️ Processing expiration job ${job.id} for Pledge: ${pledgeId}, User: ${userId}`);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Fetch the Pledge
        const pledge = await tx.pledge.findUnique({
          where: { id: pledgeId },
        });

        // 2. Abort gracefully if the Pledge status is not PENDING_PAYMENT
        if (!pledge) {
          console.log(`ℹ️ Job skipped: Pledge ${pledgeId} not found.`);
          return { promotions: [] };
        }

        if (pledge.status !== 'PENDING_PAYMENT') {
          console.log(`ℹ️ Job skipped: Pledge ${pledgeId} is not PENDING_PAYMENT (current status: ${pledge.status}).`);
          return { promotions: [] };
        }

        console.log(`⚠️ Pledge ${pledgeId} has expired. Defaulting user ${userId}...`);

        // 3. Update Pledge status to DEFAULTED
        await tx.pledge.update({
          where: { id: pledgeId },
          data: { status: 'DEFAULTED' },
        });

        // 4. Retrieve User and decrement currentTrust by 30 (clamp at 0 minimum)
        const user = await tx.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new Error('USER_NOT_FOUND');
        }

        const newTrust = Math.max(0, user.currentTrust - 30);
        await tx.user.update({
          where: { id: userId },
          data: { currentTrust: newTrust },
        });

        // 5. Write a record to the TrustLog
        await tx.trustLog.create({
          data: {
            userId,
            deltaScore: -30,
            newTotalScore: newTrust,
            reason: `Pledge ${pledgeId} defaulted due to non-payment of token advance within the checkout window.`,
          },
        });

        // 6. Invoke waitlist promotion since a slot just opened up
        const promotions = await processWaitlist(pledge.campaignId, tx);

        return {
          promotions,
          newTrust,
        };
      });

      // 7. Schedule promotion checkout expiration jobs after transaction commits successfully
      if (result && result.promotions && result.promotions.length > 0) {
        await schedulePromotions(result.promotions);
      }

      console.log(`⚙️ Expiration job ${job.id} completed successfully.`);
    } catch (err) {
      console.error(`❌ Expiration job ${job.id} failed:`, err);
      throw err; // rethrow to let BullMQ handle retries/failure marking
    }
  },
  {
    connection,
  }
);

pledgeExpirationWorker.on('active', (job) => {
  console.log(`🟢 Worker active: Job ${job.id} started.`);
});

pledgeExpirationWorker.on('completed', (job) => {
  console.log(`🔵 Worker completed: Job ${job.id} done.`);
});

pledgeExpirationWorker.on('failed', (job, err) => {
  console.error(`🔴 Worker failed: Job ${job?.id} failed with error:`, err);
});

export default pledgeExpirationWorker;
