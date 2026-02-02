/**
 * Redis client for distributed locking.
 * Uses ioredis; connects lazily on first use.
 */

import Redis from 'ioredis';
import { env } from '../config/env.js';

let client: Redis | null = null;

/**
 * Get the Redis client (singleton). Connects on first call.
 */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });
  }
  return client;
}

/**
 * Close the Redis connection (e.g. for graceful shutdown or tests).
 */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
