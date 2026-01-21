/**
 * Simple in-memory metrics counter
 * In production, consider using a proper metrics library (Prometheus, StatsD, etc.)
 */

interface Metrics {
  reservationsCreated: number;
  reservationsCancelled: number;
  reservationsUpdated: number;
  conflicts: number; // No capacity errors
  idempotentHits: number; // Idempotency key cache hits
  availabilityQueries: number;
  errors: number;
}

const metrics: Metrics = {
  reservationsCreated: 0,
  reservationsCancelled: 0,
  reservationsUpdated: 0,
  conflicts: 0,
  idempotentHits: 0,
  availabilityQueries: 0,
  errors: 0,
};

export const Metrics = {
  /**
   * Increment a metric counter
   */
  increment(metric: keyof Metrics): void {
    metrics[metric]++;
  },

  /**
   * Get current metrics
   */
  get(): Metrics {
    return { ...metrics };
  },

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    Object.keys(metrics).forEach((key) => {
      metrics[key as keyof Metrics] = 0;
    });
  },

  /**
   * Get metrics summary for logging
   */
  getSummary(): {
    total: number;
    created: number;
    cancelled: number;
    updated: number;
    conflictRate: number;
    idempotencyHitRate: number;
  } {
    const total = metrics.reservationsCreated + metrics.reservationsCancelled + metrics.reservationsUpdated;
    const conflictRate = total > 0 
      ? (metrics.conflicts / total) * 100 
      : 0;
    const idempotencyHitRate = metrics.reservationsCreated > 0
      ? (metrics.idempotentHits / metrics.reservationsCreated) * 100
      : 0;

    return {
      total,
      created: metrics.reservationsCreated,
      cancelled: metrics.reservationsCancelled,
      updated: metrics.reservationsUpdated,
      conflictRate: Math.round(conflictRate * 100) / 100,
      idempotencyHitRate: Math.round(idempotencyHitRate * 100) / 100,
    };
  },
};
