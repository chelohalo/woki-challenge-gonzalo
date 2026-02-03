/**
 * Distributed lock manager using Redis.
 * Locks per 15-minute slot in [start, end) to prevent overlapping reservations.
 */

import { nanoid } from 'nanoid';
import { getRedis } from './redis.js';
import { addMinutesToDate, formatISODateTime } from './datetime.js';
import { Errors, AppError } from './errors.js';

const SLOT_MINUTES = 15;
const DEFAULT_TTL_MS = 30_000; // 30 seconds

export interface AcquireReservationLocksOptions {
  sectorId: string;
  startISO: string;
  endISO: string;
  ttlMs?: number;
}

export interface AcquireRestaurantLocksOptions {
  restaurantId: string;
  startISO: string;
  endISO: string;
  ttlMs?: number;
}

/**
 * Generate 15-minute slot ISO strings (canonical UTC) for the interval [startISO, endISO) (end exclusive).
 */
function get15MinSlotsInRange(startISO: string, endISO: string): string[] {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const slots: string[] = [];
  let current = new Date(start.getTime());
  while (current.getTime() < end.getTime()) {
    slots.push(formatISODateTime(current));
    current = addMinutesToDate(current, SLOT_MINUTES);
  }
  return slots;
}

/**
 * Build Redis key for a sector+slot: lock:sector:{sectorId}:slot:{slotISO}
 */
function lockKey(sectorId: string, slotISO: string): string {
  return `lock:sector:${sectorId}:slot:${slotISO}`;
}

/**
 * Build Redis key for restaurant+slot (for maxGuestsPerSlot): lock:restaurant:{restaurantId}:slot:{slotISO}
 */
function restaurantLockKey(restaurantId: string, slotISO: string): string {
  return `lock:restaurant:${restaurantId}:slot:${slotISO}`;
}

/**
 * Lua script: delete key only if its value equals token (safe release).
 */
const RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;

/**
 * Acquire distributed locks for every 15-minute slot in [startISO, endISO).
 * Keys are acquired in stable (sorted) order. If any key is already held, all already-acquired keys are released and NO_CAPACITY is thrown (fail-fast).
 *
 * @returns A release function that must be called (and awaited) to free all locks. Release is safe: only deletes if token matches.
 */
export async function acquireReservationLocks(options: AcquireReservationLocksOptions): Promise<() => Promise<void>> {
  const { sectorId, startISO, endISO, ttlMs = DEFAULT_TTL_MS } = options;
  const redis = getRedis();

  const slotISOs = get15MinSlotsInRange(startISO, endISO);
  if (slotISOs.length === 0) {
    return async () => { };
  }

  const keys = slotISOs
    .map((slotISO) => lockKey(sectorId, slotISO))
    .sort(); // stable order for all callers

  const token = nanoid();
  const acquired: string[] = [];

  try {
    for (const key of keys) {
      const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
      if (result !== 'OK') {
        // Fail-fast: release what we already acquired
        for (const k of acquired) {
          await redis.eval(RELEASE_SCRIPT, 1, k, token);
        }
        throw Errors.NO_CAPACITY('Lock busy - another reservation is being processed for this slot');
      }
      acquired.push(key);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Redis errors: release acquired keys before rethrowing
    for (const k of acquired) {
      await redis.eval(RELEASE_SCRIPT, 1, k, token).catch(() => { });
    }
    throw err;
  }

  return async function release(): Promise<void> {
    for (const key of acquired) {
      await redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => { });
    }
  };
}

/**
 * Acquire distributed locks for restaurant-level slots (for maxGuestsPerSlot).
 * Use in addition to sector locks so only one reservation is created per restaurant per slot at a time.
 */
export async function acquireRestaurantReservationLocks(options: AcquireRestaurantLocksOptions): Promise<() => Promise<void>> {
  const { restaurantId, startISO, endISO, ttlMs = DEFAULT_TTL_MS } = options;
  const redis = getRedis();

  const slotISOs = get15MinSlotsInRange(startISO, endISO);
  if (slotISOs.length === 0) {
    return async () => { };
  }

  const keys = slotISOs
    .map((slotISO) => restaurantLockKey(restaurantId, slotISO))
    .sort();

  const token = nanoid();
  const acquired: string[] = [];

  try {
    for (const key of keys) {
      const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
      if (result !== 'OK') {
        for (const k of acquired) {
          await redis.eval(RELEASE_SCRIPT, 1, k, token);
        }
        throw Errors.NO_CAPACITY('Lock busy - another reservation is being processed for this time');
      }
      acquired.push(key);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    for (const k of acquired) {
      await redis.eval(RELEASE_SCRIPT, 1, k, token).catch(() => { });
    }
    throw err;
  }

  return async function release(): Promise<void> {
    for (const key of acquired) {
      await redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => { });
    }
  };
}
