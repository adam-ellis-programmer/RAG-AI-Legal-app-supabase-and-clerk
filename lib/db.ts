// we added and used npm i -D @types/pg
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// lib/db.ts — opens the connection and wraps it in Drizzle:
// Reuse one pool across dev hot-reloads instead of opening a new one each time.
const globalForDb = globalThis as unknown as { pool?: Pool }

// prettier-ignore
const pool =
  globalForDb.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })


