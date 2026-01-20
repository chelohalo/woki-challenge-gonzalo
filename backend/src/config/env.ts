import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
