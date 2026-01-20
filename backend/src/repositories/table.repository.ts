import { db } from '../db/index.js';
import { tables } from '../db/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';

export async function getTableById(id: string) {
  const result = await db.select().from(tables).where(eq(tables.id, id)).limit(1);
  return result[0] || null;
}

export async function getTablesBySector(sectorId: string) {
  return db.select().from(tables).where(eq(tables.sectorId, sectorId));
}

export async function getEligibleTables(sectorId: string, partySize: number) {
  return db
    .select()
    .from(tables)
    .where(
      and(
        eq(tables.sectorId, sectorId),
        lte(tables.minSize, partySize),
        gte(tables.maxSize, partySize)
      )
    );
}
