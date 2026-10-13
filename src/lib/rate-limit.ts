import { getRedisClient } from '@/lib/redis/client';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // in seconds
}

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

export const RATE_LIMIT_CONFIGS = {
  GENERAL_API: { windowSeconds: 60, maxRequests: 300 },
  HEAVY_ANALYSIS: { windowSeconds: 60, maxRequests: 10 },
  IMAGE_UPLOAD: { windowSeconds: 86400, maxRequests: 20 }, // 20 / day per user (§REQ-05, REQ-18)
};

export async function checkRateLimit(
  keyIdentifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.GENERAL_API
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;
  const key = `ratelimit:${keyIdentifier}`;

  try {
    const pipeline = redis.pipeline();
    // 1. Remove timestamps outside the sliding window
    pipeline.zremrangebyscore(key, 0, windowStart);
    // 2. Count requests in current window
    pipeline.zcard(key);
    // 3. Add current request timestamp (only if within limit, but check card first)
    const results = await pipeline.exec();

    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= config.maxRequests) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        reset: config.windowSeconds,
      };
    }

    // Add current timestamp and refresh TTL
    const addPipeline = redis.pipeline();
    addPipeline.zadd(key, now, `${now}-${Math.random()}`);
    addPipeline.expire(key, config.windowSeconds);
    await addPipeline.exec();

    return {
      success: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - (currentCount + 1)),
      reset: config.windowSeconds,
    };
  } catch (error) {
    console.error('[RateLimit] Redis error in rate limiter, failing open:', error);
    return {
      success: true,
      limit: config.maxRequests,
      remaining: 1,
      reset: config.windowSeconds,
    };
  }
}
