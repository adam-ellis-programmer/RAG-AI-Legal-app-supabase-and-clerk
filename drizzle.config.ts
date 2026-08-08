import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
// we added
// drizzle.config.ts — tells drizzle-kit where your schema and database are:
config({ path: '.env.local' }) // Next.js keeps secrets here; load them for drizzle-kit

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
