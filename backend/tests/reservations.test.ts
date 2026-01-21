import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { restaurants, sectors, tables, reservations, idempotencyKeys } from '../src/db/schema.js';
import { createReservationService, cancelReservationService } from '../src/services/reservation.service.js';
import { getAvailability } from '../src/services/availability.service.js';
import { Errors } from '../src/utils/errors.js';
import type { Customer } from '../src/types/index.js';

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
      const startDateTime = '2025-09-08T20:00:00-03:00';

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
      const startDateTime = '2025-09-08T20:00:00-03:00';

      // Create reservation
      await createReservationService({
        restaurantId: testRestaurantId,
        sectorId: testSectorId,
        partySize: 2,
        startDateTimeISO: startDateTime,
        customer: testCustomer,
      });

      // Check availability
      const date = new Date('2025-09-08');
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
        expect(slot.available).toBe(false);
        expect(slot.reason).toBe('no_capacity');
      }
    });
  });

  describe('Idempotency', () => {
    it('should return same reservation for same idempotency key', async () => {
      const startDateTime = '2025-09-08T20:00:00-03:00';
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
      const startDateTime = '2025-09-08T20:00:00-03:00';

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
  });

  describe('Boundaries', () => {
    it('should allow adjacent reservations without collision', async () => {
      const start1 = '2025-09-08T20:00:00-03:00';
      const start2 = '2025-09-08T21:30:00-03:00'; // Exactly when first ends (90 min later)

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
      const start1 = '2025-09-08T20:00:00-03:00';
      const start2 = '2025-09-08T20:30:00-03:00'; // Overlaps with first (30 min into 90 min reservation)

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
      const outsideShift = '2025-09-08T18:00:00-03:00'; // Between shifts

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
      const startDateTime = '2025-09-08T20:00:00-03:00';

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
      const startDateTime = '2025-09-08T20:00:00-03:00';

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
      const date = new Date('2025-09-08');
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
});
