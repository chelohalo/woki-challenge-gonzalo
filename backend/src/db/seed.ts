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
    reservationDurationMinutes: 90,
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

  // Tables
  await db.insert(tables).values([
    {
      id: 'T1',
      sectorId: 'S1',
      name: 'Table 1',
      minSize: 2,
      maxSize: 2,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'T2',
      sectorId: 'S1',
      name: 'Table 2',
      minSize: 2,
      maxSize: 4,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'T3',
      sectorId: 'S1',
      name: 'Table 3',
      minSize: 2,
      maxSize: 4,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'T4',
      sectorId: 'S1',
      name: 'Table 4',
      minSize: 4,
      maxSize: 6,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'T5',
      sectorId: 'S2',
      name: 'Table 5',
      minSize: 2,
      maxSize: 2,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ]);

  console.log('✅ Seed completed successfully!');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
