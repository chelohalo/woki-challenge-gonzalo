import { db } from './index.js';
import { restaurants, sectors, tables, reservations, idempotencyKeys } from './schema.js';

const baseDate = '2025-09-08T00:00:00-03:00';

async function seed() {
  console.log('🌱 Seeding database...');

  // Clean up existing data (for idempotent seeding)
  // Delete in order to respect foreign key constraints
  await db.delete(idempotencyKeys);
  await db.delete(reservations);
  await db.delete(tables);
  await db.delete(sectors);
  await db.delete(restaurants);

  // Restaurant
  await db.insert(restaurants).values({
    id: 'R1',
    name: 'Bistro Central',
    timezone: 'America/Argentina/Buenos_Aires',
    shifts: [
      { start: '12:00', end: '16:00' },
      { start: '20:00', end: '23:45' },
    ],
    reservationDurationMinutes: 90, // Fallback duration
    durationRules: [
      { maxPartySize: 2, durationMinutes: 75 },
      { maxPartySize: 4, durationMinutes: 90 },
      { maxPartySize: 8, durationMinutes: 120 },
      { maxPartySize: 999, durationMinutes: 150 }, // >8 guests
    ],
    minAdvanceMinutes: 30, // At least 30 minutes in advance
    maxAdvanceDays: 30, // Up to 30 days in advance
    largeGroupThreshold: 8, // Groups of 8+ require approval
    pendingHoldTTLMinutes: 60, // Pending holds expire after 60 minutes
    createdAt: baseDate,
    updatedAt: baseDate,
  });

  // Sectors
  await db.insert(sectors).values([
    {
      id: 'S1',
      restaurantId: 'R1',
      name: 'Main Hall',
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'S2',
      restaurantId: 'R1',
      name: 'Terrace',
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ]);

  // Tables - Main Hall (S1): 15 tables with various sizes
  const mainHallTables = [
    { id: 'T1', name: 'Table 1', minSize: 2, maxSize: 2 },
    { id: 'T2', name: 'Table 2', minSize: 2, maxSize: 2 },
    { id: 'T3', name: 'Table 3', minSize: 2, maxSize: 4 },
    { id: 'T4', name: 'Table 4', minSize: 2, maxSize: 4 },
    { id: 'T5', name: 'Table 5', minSize: 2, maxSize: 4 },
    { id: 'T6', name: 'Table 6', minSize: 4, maxSize: 6 },
    { id: 'T7', name: 'Table 7', minSize: 4, maxSize: 6 },
    { id: 'T8', name: 'Table 8', minSize: 4, maxSize: 6 },
    { id: 'T9', name: 'Table 9', minSize: 6, maxSize: 8 },
    { id: 'T10', name: 'Table 10', minSize: 6, maxSize: 8 },
    { id: 'T11', name: 'Table 11', minSize: 2, maxSize: 3 },
    { id: 'T12', name: 'Table 12', minSize: 2, maxSize: 3 },
    { id: 'T13', name: 'Table 13', minSize: 2, maxSize: 3 },
    { id: 'T14', name: 'Table 14', minSize: 4, maxSize: 5 },
    { id: 'T15', name: 'Table 15', minSize: 4, maxSize: 5 },
  ];

  // Tables - Terrace (S2): 12 tables with various sizes
  const terraceTables = [
    { id: 'T16', name: 'Table 16', minSize: 2, maxSize: 2 },
    { id: 'T17', name: 'Table 17', minSize: 2, maxSize: 2 },
    { id: 'T18', name: 'Table 18', minSize: 2, maxSize: 2 },
    { id: 'T19', name: 'Table 19', minSize: 2, maxSize: 4 },
    { id: 'T20', name: 'Table 20', minSize: 2, maxSize: 4 },
    { id: 'T21', name: 'Table 21', minSize: 2, maxSize: 4 },
    { id: 'T22', name: 'Table 22', minSize: 4, maxSize: 6 },
    { id: 'T23', name: 'Table 23', minSize: 4, maxSize: 6 },
    { id: 'T24', name: 'Table 24', minSize: 6, maxSize: 8 },
    { id: 'T25', name: 'Table 25', minSize: 6, maxSize: 8 },
    { id: 'T26', name: 'Table 26', minSize: 2, maxSize: 3 },
    { id: 'T27', name: 'Table 27', minSize: 4, maxSize: 5 },
  ];

  // Insert Main Hall tables
  await db.insert(tables).values(
    mainHallTables.map((t) => ({
      id: t.id,
      sectorId: 'S1',
      name: t.name,
      minSize: t.minSize,
      maxSize: t.maxSize,
      createdAt: baseDate,
      updatedAt: baseDate,
    }))
  );

  // Insert Terrace tables
  await db.insert(tables).values(
    terraceTables.map((t) => ({
      id: t.id,
      sectorId: 'S2',
      name: t.name,
      minSize: t.minSize,
      maxSize: t.maxSize,
      createdAt: baseDate,
      updatedAt: baseDate,
    }))
  );

  console.log('✅ Seed completed successfully!');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
