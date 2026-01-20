import { db } from '../db/index.js';
import { restaurants } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function getRestaurantById(id: string) {
  const result = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
  return result[0] || null;
}
