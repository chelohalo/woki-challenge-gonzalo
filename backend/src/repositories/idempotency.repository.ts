import { db } from '../db/index.js';
import { idempotencyKeys } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function getIdempotencyResponse(key: string) {
  const result = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);
  return result[0] || null;
}

export async function storeIdempotencyResponse(key: string, response: unknown, createdAt: string) {
  await db.insert(idempotencyKeys).values({
    key,
    response: response as Record<string, unknown>,
    createdAt,
  });
}
