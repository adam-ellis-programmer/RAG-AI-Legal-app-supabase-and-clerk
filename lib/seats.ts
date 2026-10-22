// uses backend here inside the app as we may need to call it from outside the app
import { createClerkClient } from '@clerk/backend'

// Clerk treats 0 as "no limit"
export const UNLIMITED_MEMBERS = 0

// Tells Clerk the most members this firm may have.
// Clerk then blocks invites past this number, everywhere, including its own UI.
// Uses @clerk/backend (not @clerk/nextjs) so it works in scripts too.
export async function setOrgSeatLimit(orgId: string, max: number) {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  await clerk.organizations.updateOrganization(orgId, { maxAllowedMemberships: max })
}