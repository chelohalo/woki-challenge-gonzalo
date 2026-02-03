import { db } from './index.js';
import { restaurants, sectors, tables, reservations, idempotencyKeys } from './schema.js';

// Use current time for audit fields so seed stays relevant whenever run
function nowISO(): string {
  return new Date().toISOString();
}

async function seed() {
  console.log('🌱 Seeding database...');

  const baseDate = nowISO();

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
    maxAdvanceDays: 90, // Up to 90 days so next months are bookable
    largeGroupThreshold: 8, // Groups of 8+ require approval
    pendingHoldTTLMinutes: 60, // Pending holds expire after 60 minutes
    createdAt: baseDate,
    updatedAt: baseDate,
  });

  // Sectors: Main Hall, Terrace, Bar
  await db.insert(sectors).values([
    { id: 'S1', restaurantId: 'R1', name: 'Main Hall', createdAt: baseDate, updatedAt: baseDate },
    { id: 'S2', restaurantId: 'R1', name: 'Terrace', createdAt: baseDate, updatedAt: baseDate },
    { id: 'S3', restaurantId: 'R1', name: 'Bar', createdAt: baseDate, updatedAt: baseDate },
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

  // Tables - Bar (S3): 6 tables
  const barTables = [
    { id: 'T28', name: 'Bar 1', minSize: 1, maxSize: 2 },
    { id: 'T29', name: 'Bar 2', minSize: 1, maxSize: 2 },
    { id: 'T30', name: 'Bar 3', minSize: 2, maxSize: 4 },
    { id: 'T31', name: 'Bar 4', minSize: 2, maxSize: 4 },
    { id: 'T32', name: 'Bar 5', minSize: 2, maxSize: 4 },
    { id: 'T33', name: 'Bar 6', minSize: 4, maxSize: 6 },
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

  // Insert Bar tables
  await db.insert(tables).values(
    barTables.map((t) => ({
      id: t.id,
      sectorId: 'S3',
      name: t.name,
      minSize: t.minSize,
      maxSize: t.maxSize,
      createdAt: baseDate,
      updatedAt: baseDate,
    }))
  );

  // --- Sample reservations for the next 1–2 months (so the app has data to show) ---
  const offset = '-03:00'; // America/Argentina/Buenos_Aires

  function dateInDays(daysFromNow: number, timeHHMM: string): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T${timeHHMM}:00${offset}`;
  }

  function addMinutesISO(iso: string, minutes: number): string {
    return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
  }

  const sampleReservations = [
    { start: dateInDays(7, '20:00'), partySize: 2, durationMin: 75, sectorId: 'S1' as const, tableId: 'T1', customerName: 'Ana García', customerPhone: '+54 11 4444-1111', customerEmail: 'ana@example.com' },
    { start: dateInDays(14, '12:30'), partySize: 4, durationMin: 90, sectorId: 'S1' as const, tableId: 'T4', customerName: 'Carlos López', customerPhone: '+54 11 4444-2222', customerEmail: 'carlos@example.com' },
    { start: dateInDays(21, '20:00'), partySize: 2, durationMin: 75, sectorId: 'S1' as const, tableId: 'T2', customerName: 'María Fernández', customerPhone: '+54 11 4444-3333', customerEmail: 'maria@example.com' },
    { start: dateInDays(10, '20:00'), partySize: 2, durationMin: 75, sectorId: 'S2' as const, tableId: 'T16', customerName: 'Juan Pérez', customerPhone: '+54 11 4444-4444', customerEmail: 'juan@example.com' },
    { start: dateInDays(18, '20:30'), partySize: 4, durationMin: 90, sectorId: 'S2' as const, tableId: 'T19', customerName: 'Laura Martínez', customerPhone: '+54 11 4444-5555', customerEmail: 'laura@example.com' },
    { start: dateInDays(30, '21:00'), partySize: 2, durationMin: 75, sectorId: 'S2' as const, tableId: 'T17', customerName: 'Pedro Sánchez', customerPhone: '+54 11 4444-6666', customerEmail: 'pedro@example.com' },
    { start: dateInDays(3, '20:00'), partySize: 2, durationMin: 75, sectorId: 'S3' as const, tableId: 'T28', customerName: 'Sofía Ruiz', customerPhone: '+54 11 4444-7777', customerEmail: 'sofia@example.com' },
    { start: dateInDays(45, '21:00'), partySize: 2, durationMin: 75, sectorId: 'S3' as const, tableId: 'T29', customerName: 'Diego Torres', customerPhone: '+54 11 4444-8888', customerEmail: 'diego@example.com' },
  ];

  for (let i = 0; i < sampleReservations.length; i++) {
    const r = sampleReservations[i];
    const id = `RES_SEED${String(i + 1).padStart(2, '0')}`;
    const startISO = r.start;
    const endISO = addMinutesISO(startISO, r.durationMin);
    await db.insert(reservations).values({
      id,
      restaurantId: 'R1',
      sectorId: r.sectorId,
      tableIds: [r.tableId],
      partySize: r.partySize,
      startDateTime: startISO,
      endDateTime: endISO,
      status: 'CONFIRMED',
      expiresAt: null,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      notes: null,
      createdAt: baseDate,
      updatedAt: baseDate,
    });
  }

  console.log('✅ Seed completed successfully!');
  console.log(`   Restaurant R1, sectors: Main Hall (S1), Terrace (S2), Bar (S3).`);
  console.log(`   ${mainHallTables.length + terraceTables.length + barTables.length} tables, ${sampleReservations.length} sample reservations for the next months.`);
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
