/**
 * In-memory lock manager for concurrency control
 * Prevents double-booking by locking sector+slot combinations
 */

import { Mutex } from 'async-mutex';
import { Errors } from './errors.js';

// Map of mutexes per sector+slot combination
const mutexes = new Map<string, Mutex>();

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

  // Return release function
  return () => {
    release();
    // Clean up mutex if no one is waiting (optional optimization)
    // For now, we keep them to avoid recreation overhead
  };
}
