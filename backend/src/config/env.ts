import { z } from 'zod';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().optional(),
  // Authentication credentials (for demo - in production use proper auth)
  AUTH_USERNAME: z.string().default('user123'),
  AUTH_PASSWORD: z.string().default('pass123'),
});

export const env = envSchema.parse(process.env);
