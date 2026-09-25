import Redis from 'ioredis';
import { env } from '@/lib/env';

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
    });

    redisInstance.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
    });

    redisInstance.on('connect', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Redis] Connected to Redis cluster/instance');
      }
    });
  }

  return redisInstance;
}

export default getRedisClient;
