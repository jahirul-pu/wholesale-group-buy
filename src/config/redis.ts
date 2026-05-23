import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Lazy connect to prevent immediate startup crash if Redis is unavailable
const pubClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy(times: number) {
    // Only attempt reconnection a few times
    if (times > 3) {
      return null; // stop retrying
    }
    return Math.min(times * 100, 2000);
  }
});

const subClient = pubClient.duplicate();

export { pubClient, subClient };
