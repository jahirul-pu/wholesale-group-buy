import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// BullMQ requires maxRetriesPerRequest to be null on its Redis connections
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  }
});

const pledgeExpirationQueue = new Queue('pledge-expiration', {
  connection,
});

/**
 * Places a payment checkout window expiration job in the queue
 */
export async function schedulePaymentWindow(pledgeId: string, userId: string, delayMs: number) {
  const jobName = `expire-${pledgeId}`;
  
  await pledgeExpirationQueue.add(
    jobName,
    { pledgeId, userId },
    { 
      delay: delayMs, 
      removeOnComplete: true, 
      removeOnFail: true 
    }
  );
  
  console.log(`✅ Scheduled payment expiration job in queue for Pledge: ${pledgeId} with delay: ${delayMs}ms`);
}
