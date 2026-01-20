import { db } from '../db/index.js';
import { reservations } from '../db/schema.js';
import { eq, and, gte, lt } from 'drizzle-orm';

export async function getReservationById(id: string) {
  const result = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, id))
    .limit(1);
  return result[0] || null;
}

export async function getReservationsByDay(
  restaurantId: string,
  date: Date,
  sectorId?: string
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const conditions = [
    eq(reservations.restaurantId, restaurantId),
    gte(reservations.startDateTime, dayStart.toISOString()),
    lt(reservations.startDateTime, dayEnd.toISOString()),
    eq(reservations.status, 'CONFIRMED'),
  ];

  if (sectorId) {
    conditions.push(eq(reservations.sectorId, sectorId));
  }

  return db.select().from(reservations).where(and(...conditions));
}

export async function getOverlappingReservations(
  tableIds: string[],
  startDateTime: string,
  endDateTime: string
) {
  // Get all confirmed reservations that might overlap
  // Overlap: (start < endDateTime) AND (end > startDateTime)
  const allReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'CONFIRMED'),
        // start < endDateTime
        // end > startDateTime
        // We'll filter in memory for the overlap check
      )
    );

  // Filter by overlap and table IDs
  return allReservations.filter((r) => {
    // Check overlap: (r.start < endDateTime) AND (r.end > startDateTime)
    const overlaps = r.startDateTime < endDateTime && r.endDateTime > startDateTime;
    if (!overlaps) return false;
    
    // Check if any table overlaps
    return r.tableIds.some((tid) => tableIds.includes(tid));
  });
}

export async function createReservation(data: {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[];
  partySize: number;
  startDateTime: string;
  endDateTime: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}) {
  await db.insert(reservations).values(data);
  return getReservationById(data.id);
}

export async function cancelReservation(id: string, updatedAt: string) {
  await db
    .update(reservations)
    .set({ status: 'CANCELLED', updatedAt })
    .where(eq(reservations.id, id));
}
