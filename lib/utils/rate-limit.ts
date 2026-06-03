import { Redis } from "@upstash/redis";
import { GameError } from "@/lib/game/errors";

const buckets = new Map<string, { count: number; resetAt: number }>();

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new GameError("Too many requests. Slow down a little.", 429);
  }

  bucket.count += 1;
}

export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new GameError("Redis rate limiter is not configured.", 500);
    }
    memoryRateLimit(key, limit, windowMs);
    return;
  }

  const redisKey = `rate:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, windowMs);
  }
  if (count > limit) {
    throw new GameError("Too many requests. Slow down a little.", 429);
  }
}
