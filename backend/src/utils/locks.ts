/**
 * In-memory lock manager for concurrency control
 * Prevents double-booking by locking sector+slot combinations
 */

import { Mutex } from 'async-mutex';
import { Errors } from './errors.js';

// Map of mutexes per sector+slot combination
const mutexes = new Map<string, Mutex>();

// Track last access time for cleanup
const lastAccess = new Map<string, number>();

// Cleanup interval: remove unused mutexes older than 1 hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Start cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval() {
  if (cleanupInterval) return; // Already started

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, lastUsed] of lastAccess.entries()) {
      if (now - lastUsed > MAX_AGE_MS) {
        const mutex = mutexes.get(key);
        // Only delete if mutex is not locked and not in use
        if (mutex && !mutex.isLocked()) {
          keysToDelete.push(key);
        }
      }
    }

    // Delete unused mutexes
    for (const key of keysToDelete) {
      mutexes.delete(key);
      lastAccess.delete(key);
    }

    if (keysToDelete.length > 0) {
      // Log cleanup for observability (optional, can be removed if too verbose)
      // console.log(`Cleaned up ${keysToDelete.length} unused locks`);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Generate lock key from sector and slot
 */
function getLockKey(sectorId: string, startDateTimeISO: string): string {
  return `${sectorId}:${startDateTimeISO}`;
}

/**
 * Acquire a lock for a sector+slot combination
 * Returns a release function that must be called to free the lock
 * Throws NO_CAPACITY if lock is already taken (fail-fast for concurrency)
 */
export async function acquireLock(
  sectorId: string,
  startDateTimeISO: string
): Promise<() => void> {
  const key = getLockKey(sectorId, startDateTimeISO);

  // Start cleanup interval on first use
  startCleanupInterval();

  // Get or create mutex for this key
  let mutex = mutexes.get(key);
  if (!mutex) {
    mutex = new Mutex();
    mutexes.set(key, mutex);
  }

  // Fail-fast: if lock is already taken, throw immediately
  if (mutex.isLocked()) {
    throw Errors.NO_CAPACITY('Lock busy - another reservation is being processed for this slot');
  }

  // Acquire lock
  const release = await mutex.acquire();

  // Update last access time
  lastAccess.set(key, Date.now());

  // Return release function
  return () => {
    release();
    // Update last access time when released
    lastAccess.set(key, Date.now());
  };
}

/**
 * Get current lock statistics (useful for debugging/monitoring)
 */
export function getLockStats() {
  return {
    totalLocks: mutexes.size,
    lockedCount: Array.from(mutexes.values()).filter(m => m.isLocked()).length,
    oldestLock: lastAccess.size > 0
      ? Math.min(...Array.from(lastAccess.values()))
      : null,
  };
}
