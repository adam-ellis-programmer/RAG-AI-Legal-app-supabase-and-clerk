// lib/demo.ts
// The shared demo firm is read-only: visitors can browse and ask questions,
// but not upload, delete, or change the team or a case's status. Everything
// they write (queries, audit entries) is cleared by the nightly reset.
import { auth } from '@clerk/nextjs/server'

/** The Clerk organisation id of the demo firm. Set in .env. */
export const DEMO_ORG_ID = process.env.DEMO_ORG_ID ?? ''
 
export function isDemoOrg(orgId: string | null | undefined) {
  return !!orgId && !!DEMO_ORG_ID && orgId === DEMO_ORG_ID
}

/** Throw in a server action if this firm may not change anything. */
export async function assertNotDemo() {
  const { orgId } = await auth()
  if (isDemoOrg(orgId)) {
    throw new Error('This is a read-only demo. Sign up for your own firm to make changes.')
  }
} 