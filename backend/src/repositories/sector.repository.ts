import { db } from '../db/index.js';
import { sectors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function getSectorById(id: string) {
  const result = await db.select().from(sectors).where(eq(sectors.id, id)).limit(1);
  return result[0] || null;
}

export async function getSectorsByRestaurant(restaurantId: string) {
  return db.select().from(sectors).where(eq(sectors.restaurantId, restaurantId));
}
