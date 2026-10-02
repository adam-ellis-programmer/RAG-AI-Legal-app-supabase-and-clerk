// scripts/seed-demo/config.ts
// Shared by every stage. Reads env directly: lib/demo.ts imports
// @clerk/nextjs/server, which expects to run inside Next.js, not a script.
import { createClerkClient } from '@clerk/backend'

export const ORG_ID = process.env.DEMO_ORG_ID ?? ''
export const FIRM_NAME = 'Wakefield & Croft LLP'

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

/** Stop before touching anything if the environment is incomplete. */
export function checkEnv() {
    // Only checks the three in the array
  const missing = ['DEMO_ORG_ID', 'CLERK_SECRET_KEY', 'DATABASE_URL'].filter(
    (k) => !process.env[k],
  )
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`)
}