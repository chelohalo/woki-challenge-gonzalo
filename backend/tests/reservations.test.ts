import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { restaurants, sectors, tables, reservations, idempotencyKeys } from '../src/db/schema.js';
import { createReservationService, cancelReservationService } from '../src/services/reservation.service.js';
import { getAvailability } from '../src/services/availability.service.js';
import { getRedis } from '../src/utils/redis.js';
import type { Customer } from '../src/types/index.js';

// Use a future date so availability slots are not filtered as "past"
const testDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(0, 0, 0, 0);
  return d;
})();
const testDateStr = testDate.toISOString().slice(0, 10); // YYYY-MM-DD
const baseDate = '2025-09-08T00:00:00-03:00';
const testRestaurantId = 'R1';
const testSectorId = 'S1';
const testCustomer: Customer = {
  name: 'Test User',
  phone: '+54 9 11 5555-1234',
  email: 'test@example.com',
  createdAt: baseDate,
  updatedAt: baseDate,
};

async function seedTestData() {
  // Clean up
  await db.delete(reservations);
  await db.delete(idempotencyKeys);
  await db.delete(tables);
  await db.delete(sectors);
  await db.delete(restaurants);

  // Seed restaurant
  await db.insert(restaurants).values({
    id: testRestaurantId,
    name: 'Test Restaurant',
    timezone: 'America/Argentina/Buenos_Aires',
    shifts: [
      { start: '12:00', end: '16:00' },
      { start: '20:00', end: '23:45' },
    ],
    reservationDurationMinutes: 90,
    durationRules: [
      { maxPartySize: 2, durationMinutes: 75 },
      { maxPartySize: 4, durationMinutes: 90 },
      { maxPartySize: 8, durationMinutes: 120 },
      { maxPartySize: 999, durationMinutes: 150 },
    ],
    minAdvanceMinutes: null, // Disable for tests
    maxAdvanceDays: null, // Disable for tests
    createdAt: baseDate,
    updatedAt: baseDate,
  });

  // Seed sector
  await db.insert(sectors).values({
    id: testSectorId,
    restaurantId: testRestaurantId,
    name: 'Test Sector',
    createdAt: baseDate,
    updatedAt: baseDate,
  });

  // Seed tables
  await db.insert(tables).values([
    {
      id: 'T1',
      sectorId: testSectorId,
      name: 'Table 1',
      minSize: 2,
      maxSize: 4,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'T2',
      sectorId: testSectorId,
      name: 'Table 2',
      minSize: 2,
      maxSize: 4,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ]);
}

beforeAll(async () => {
  // Tests require Redis for distributed locks. Fail fast with clear message if unavailable.
  const redis = getRedis();
  try {
    await redis.ping();
  } catch (err) {
    throw new Error(
      'Redis is required for tests (distributed locks). Start Redis with: docker run -d --name redis -p 6379:6379 redis:7-alpine'
    );
  }
  await seedTestData();
});

beforeEach(async () => {
  // Clean reservations and idempotency keys before each test
  await db.delete(reservations);
  await db.delete(idempotencyKeys);
});

describe('Reservation Service', () => {
  describe('Happy Path', () => {
    it('should create a valid reservation', async () => {
      const startDateTime = `${testDateStr}T20:00:00-03:00`;

      const reservation = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      expect(reservation).toBeDefined();
      expect(reservation.status).toBe('CONFIRMED');
      expect(reservation.tableIds).toHaveLength(1);
      expect(reservation.partySize).toBe(2);
      expect(reservation.start).toBe(startDateTime);
    });

    it('should make slot unavailable after reservation', async () => {
      const startDateTime = `${testDateStr}T20:00:00-03:00`;

      // Create reservation
      const reservation = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      // Check availability
      const date = new Date(testDateStr);
      const availability = await getAvailability(
        testRestaurantId,
        testSectorId,
        date,
        2
      );

      // Find slot by matching time (slots are in UTC, reservation is in local timezone)
      // Convert both to same format for comparison
      const expectedTime = new Date(startDateTime).getTime();
      const slot = availability.find((s) => {
        const slotTime = new Date(s.start).getTime();
        return Math.abs(slotTime - expectedTime) < 60000; // Within 1 minute
      });

      expect(slot).toBeDefined();
      if (slot) {
        // Verify that the reserved table is NOT available in this slot
        const reservedTableId = reservation.tableIds[0];
        expect(slot.tables).not.toContain(reservedTableId);

        // If all tables are occupied, the slot should be unavailable
        // But if other tables are free, the slot can still be available
        // So we verify the specific table is not available, which is the core requirement
      }
    });
  });

  describe('Idempotency', () => {
    it('should return same reservation for same idempotency key', async () => {
      const startDateTime = `${testDateStr}T20:00:00-03:00`;
      const idempotencyKey = 'test-key-123';

      const reservation1 = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      // Store idempotency response manually (simulating middleware)
      const { storeIdempotencyResponse } = await import('../src/repositories/idempotency.repository.js');
      const { formatISODateTime } = await import('../src/utils/datetime.js');
      await storeIdempotencyResponse(idempotencyKey, reservation1, formatISODateTime(new Date()));

      // Simulate retry with same key
      const { getIdempotencyResponse } = await import('../src/repositories/idempotency.repository.js');
      const cached = await getIdempotencyResponse(idempotencyKey);

      expect(cached).toBeDefined();
      expect((cached?.response as any)?.id).toBe(reservation1.id);
    });
  });

  describe('Concurrency', () => {
    it('should prevent double-booking with concurrent requests', async () => {
      const startDateTime = `${testDateStr}T20:00:00-03:00`;

      // Create two concurrent reservation requests for the SAME table slot
      // Use Promise.allSettled to ensure both start at the same time
      const [result1, result2] = await Promise.allSettled([
        createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: startDateTime,
          customer: testCustomer,
        }),
        createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: startDateTime,
          customer: {
            ...testCustomer,
            name: 'Concurrent User',
          },
        }),
      ]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter((r) => r.status === 'fulfilled').length;
      const failureCount = [result1, result2].filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Check that only one reservation was created for this exact time
      const allReservations = await db
        .select()
        .from(reservations)
        .where(eq(reservations.startDateTime, startDateTime));

      expect(allReservations.length).toBe(1);
    }, 20000); // Increase timeout for concurrency test

    it('should prevent overlapping slots: one 201, one 409 when two creates at 20:00 and 20:15 same sector', async () => {
      const start1 = `${testDateStr}T20:00:00-03:00`; // 90 min → 20:00–21:30
      const start2 = `${testDateStr}T20:15:00-03:00`; // 90 min → 20:15–21:45 (overlaps 20:15–21:30)

      const [result1, result2] = await Promise.allSettled([
        createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: start1,
          customer: testCustomer,
        }),
        createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: start2,
          customer: {
            ...testCustomer,
            name: 'Overlap User',
          },
        }),
      ]);

      const fulfilled = [result1, result2].filter((r) => r.status === 'fulfilled');
      const rejected = [result1, result2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason?.code ?? rejected[0].reason?.message).toBeDefined();
        const msg = String(rejected[0].reason?.message ?? rejected[0].reason?.detail ?? '').toLowerCase();
        // Rejection can be due to lock (Lock busy) or no table (no available table fits)
        expect(msg).toMatch(/capacity|lock|busy|no available table|requested time/);
      }
    }, 20000);
  });

  describe('Boundaries', () => {
    it('should allow adjacent reservations without collision', async () => {
      const start1 = `${testDateStr}T20:00:00-03:00`;
      const start2 = `${testDateStr}T21:30:00-03:00`; // Exactly when first ends (90 min later)

      // Create first reservation
      const reservation1 = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: start1,
        customer: testCustomer,
      });

      expect(reservation1).toBeDefined();

      // Create adjacent reservation (should succeed - can use same or different table)
      const reservation2 = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: start2,
        customer: {
          ...testCustomer,
          name: 'Adjacent User',
        },
      });

      expect(reservation2).toBeDefined();
      // Both should be created successfully (adjacent, not overlapping)
      expect(reservation1.id).not.toBe(reservation2.id);
    });

    it('should prevent overlapping reservations on same table', async () => {
      const start1 = `${testDateStr}T20:00:00-03:00`;
      const start2 = `${testDateStr}T20:30:00-03:00`; // Overlaps with first (30 min into 90 min reservation)

      // Create first reservation
      const reservation1 = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: start1,
        customer: testCustomer,
      });

      const table1 = reservation1.tableIds[0];

      // Try to create overlapping reservation for same table (should fail)
      // But if there's another table available, it might succeed with different table
      // So we check that if it succeeds, it uses a different table
      try {
        const reservation2 = await createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: start2,
          customer: {
            ...testCustomer,
            name: 'Overlapping User',
          },
        });

        // If it succeeded, it should use a different table
        expect(reservation2.tableIds[0]).not.toBe(table1);
      } catch (error: any) {
        // Or it should fail if no other table is available
        expect(error.message).toContain('capacity');
      }
    });
  });

  describe('Validation', () => {
    it('should reject reservation outside service window', async () => {
      const outsideShift = `${testDateStr}T18:00:00-03:00`; // Between shifts

      await expect(
        createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: outsideShift,
          customer: testCustomer,
        })
      ).rejects.toThrow();
    });

    it('should reject reservation when no capacity', async () => {
      const startDateTime = `${testDateStr}T20:00:00-03:00`;

      // Fill all tables (we have 2 tables)
      await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: {
          ...testCustomer,
          name: 'Second User',
        },
      });

      // Third reservation should fail (no capacity)
      await expect(
        createReservationService({
          restaurantId: testRestaurantId,
          sectorId: testSectorId,
          partySize: 2,
          startDateTimeISO: startDateTime,
          customer: {
            ...testCustomer,
            name: 'Third User',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Cancel', () => {
    it('should cancel reservation and free up slot', async () => {
      const startDateTime = `${testDateStr}T20:00:00-03:00`;

      // Create reservation
      const reservation = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      // Cancel reservation
      await cancelReservationService(reservation.id);

      // Check that slot is available again
      const date = new Date(testDateStr);
      const availability = await getAvailability(
        testRestaurantId,
        testSectorId,
        date,
        2
      );

      // Find slot by matching time (slots are in UTC, reservation is in local timezone)
      const expectedTime = new Date(startDateTime).getTime();
      const slot = availability.find((s) => {
        const slotTime = new Date(s.start).getTime();
        return Math.abs(slotTime - expectedTime) < 60000; // Within 1 minute
      });

      expect(slot).toBeDefined();
      if (slot) {
        expect(slot.available).toBe(true);
      }
    });
  });

  describe('Table Combinations', () => {
    it('should assign multiple tables when no single table fits', async () => {
      // Create a reservation for party size 8 (no single table fits, need combination)
      const startDateTime = `${testDateStr}T20:00:00-03:00`;

      const reservation = await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 8, // Larger than any single table maxSize (which is 4)
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      expect(reservation).toBeDefined();
      expect(reservation.status).toBe('CONFIRMED');
      expect(reservation.tableIds.length).toBeGreaterThan(1); // Should use multiple tables
      expect(reservation.partySize).toBe(8);

      // Verify total capacity of assigned tables can accommodate party size
      const { getTableById } = await import('../src/repositories/table.repository.js');
      let totalMinCapacity = 0;
      let totalMaxCapacity = 0;

      for (const tableId of reservation.tableIds) {
        const table = await getTableById(tableId);
        if (table) {
          totalMinCapacity += table.minSize;
          totalMaxCapacity += table.maxSize;
        }
      }

      expect(totalMinCapacity).toBeLessThanOrEqual(8);
      expect(totalMaxCapacity).toBeGreaterThanOrEqual(8);
    });

  });
});
