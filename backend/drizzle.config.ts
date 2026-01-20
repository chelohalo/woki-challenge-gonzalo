import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();




export default defineConfig({
  driver: 'turso',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});