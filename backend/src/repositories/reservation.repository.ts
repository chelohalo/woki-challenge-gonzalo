import { db } from '../db/index.js';
import { reservations } from '../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';
import { getZonedDayStartUTC } from '../utils/datetime.js';

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
  sectorId?: string,
  timezone?: string
) {
  // Get restaurant timezone if not provided (we'll need to fetch it)
  // For now, assume it's passed or use a default
  const tz = timezone || 'UTC';
  
  // Get calendar day bounds in UTC (representing local day in restaurant timezone)
  const dayStartUTC = getZonedDayStartUTC(date, tz);
  const dayEndUTC = new Date(dayStartUTC);
  dayEndUTC.setUTCHours(23, 59, 59, 999);

  // Get all confirmed reservations for the restaurant (and sector if specified)
  // Filter by timestamp in memory to avoid timezone issues with string comparison
  const conditions = [
    eq(reservations.restaurantId, restaurantId),
    eq(reservations.status, 'CONFIRMED'),
  ];

  if (sectorId) {
    conditions.push(eq(reservations.sectorId, sectorId));
  }

  const allReservations = await db.select().from(reservations).where(and(...conditions));

  // Filter by day using timestamp comparison (handles timezone correctly)
  const dayStartTime = dayStartUTC.getTime();
  const dayEndTime = dayEndUTC.getTime();

  return allReservations.filter((r) => {
    const rStartTime = new Date(r.startDateTime).getTime();
    return rStartTime >= dayStartTime && rStartTime < dayEndTime;
  });
}

export async function getOverlappingReservations(
  tableIds: string[],
  startDateTime: string,
  endDateTime: string,
  excludeReservationId?: string
) {
  // Get all confirmed reservations
  // We need to check ALL reservations, not just by date, because overlaps can span days
  const conditions = [eq(reservations.status, 'CONFIRMED')];
  
  if (excludeReservationId) {
    // Exclude the reservation being updated
    conditions.push(ne(reservations.id, excludeReservationId));
  }

  const allReservations = await db
    .select()
    .from(reservations)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

  // Filter by overlap and table IDs using timestamp comparison
  const startTime = new Date(startDateTime).getTime();
  const endTime = new Date(endDateTime).getTime();

  return allReservations.filter((r) => {
    const rStartTime = new Date(r.startDateTime).getTime();
    const rEndTime = new Date(r.endDateTime).getTime();
    
    // Check overlap: (r.start < endDateTime) AND (r.end > startDateTime)
    const overlaps = rStartTime < endTime && rEndTime > startTime;
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

export async function updateReservation(
  id: string,
  data: {
    sectorId?: string;
    tableIds?: string[];
    partySize?: number;
    startDateTime?: string;
    endDateTime?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
    updatedAt: string;
  }
) {
  const updateData: any = { updatedAt: data.updatedAt };
  
  if (data.sectorId !== undefined) updateData.sectorId = data.sectorId;
  if (data.tableIds !== undefined) updateData.tableIds = data.tableIds;
  if (data.partySize !== undefined) updateData.partySize = data.partySize;
  if (data.startDateTime !== undefined) updateData.startDateTime = data.startDateTime;
  if (data.endDateTime !== undefined) updateData.endDateTime = data.endDateTime;
  if (data.customerName !== undefined) updateData.customerName = data.customerName;
  if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
  if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db
    .update(reservations)
    .set(updateData)
    .where(eq(reservations.id, id));
}
