// lib/matter-access.ts --- HELPERS
import { auth, clerkClient } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { matters, matterMembers } from '@/lib/schema'
import { displayName } from '@/lib/audit'
import { cache } from 'react'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: string) => UUID_RE.test(v)

/**
 * The two-layer wall, in one place.
 * Returns null unless: signed in, the matter belongs to this firm (layer 1),
 * AND the current user is on the matter's team (layer 2).
 */
export async function getMatterAccess(matterId: string) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return null

  // A malformed id would make Postgres throw (500) instead of a clean 404.
  if (!isUuid(matterId)) return null

  // LAYER 1 — firm wall
  const [matter] = await db
    .select()
    .from(matters)
    .where(and(eq(matters.id, matterId), eq(matters.orgId, orgId)))
    .limit(1)
  if (!matter) return null

  // LAYER 2 — ethical wall
  const [membership] = await db
    .select()
    .from(matterMembers)
    .where(
      and(
        eq(matterMembers.matterId, matterId),
        eq(matterMembers.userId, userId),
      ),
    )
    .limit(1)
  if (!membership) return null

  return { userId, orgId, matter, membership }
}

export type OrgMember = { userId: string; name: string; email: string }

/** Everyone in the firm, resolved via Clerk (the source of truth for who is in the org). */
// cache(): within one request, the first call asks Clerk; any later call with the
// same orgId (layout + page, several components) gets the same result, no extra network call.
// prettier-ignore
export const getOrgMembers = cache(async (orgId: string): Promise<OrgMember[]> => {

  const client = await clerkClient()
  const { data } = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 100,
  })

  return data.flatMap((m) => {
    const u = m.publicUserData
    if (!u?.userId) return []

    const name = displayName(u.firstName, u.lastName, u.identifier) ?? u.identifier
    return [{ userId: u.userId, name, email: u.identifier }]
  })
})


/**
 * What cache() does, precisely
 * It remembers results for one request only (one page load, one form submission). The next request starts fresh, so if someone joins the firm, the next page load sees them.
 * It matches on the arguments: getOrgMembers('org_A') and getOrgMembers('org_B') are separate entries.
 * It stores the promise, not just the result. So even when the layout and page call it at the same moment (before the first call has finished), the second one waits for the first rather than making its own request.
 */
