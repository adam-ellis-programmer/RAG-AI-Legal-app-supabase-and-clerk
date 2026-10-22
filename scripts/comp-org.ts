// scripts/comp-org.ts
// Give a firm Pro for free, or take it away again. Runs from your laptop only:
// there's no web route for this, so nothing to attack.
//
//   npm run comp-org -- org_abc123 "Adam's test firm"
//   npm run comp-org -- org_abc123 --remove
import { and, eq } from 'drizzle-orm'
import { createClerkClient } from '@clerk/backend'
import { db } from '@/lib/db'
import { orgPlans } from '@/lib/schema'
import { setOrgSeatLimit, UNLIMITED_MEMBERS } from '@/lib/seats'
import { PLANS } from '@/lib/plan'

async function main() {
  const [orgId, arg] = process.argv.slice(2)
  if (!orgId?.startsWith('org_')) {
    throw new Error('Usage: npm run comp-org -- <org_id> ["note" | --remove]')
  }

  // Look the firm up in Clerk first, so a typo in the ID fails loudly
  // instead of silently comping a firm that doesn't exist.
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  const org = await clerk.organizations.getOrganization({ organizationId: orgId })

  if (arg === '--remove') {
    // Only deletes comp rows, so a Stripe-paying firm is never touched.
    const removed = await db
      .delete(orgPlans)
      .where(and(eq(orgPlans.orgId, orgId), eq(orgPlans.source, 'comp')))
      .returning({ orgId: orgPlans.orgId })

    if (!removed.length) {
      console.log(`${org.name} has no comp to remove.`)
      return
    }
    await setOrgSeatLimit(orgId, PLANS.free.maxMembers) // back to Free's limit
    console.log(`Removed comp from ${org.name}: back on Free.`)
    return
  }

  const [existing] = await db
    .select()
    .from(orgPlans)
    .where(eq(orgPlans.orgId, orgId))
    .limit(1)

  // Never overwrite a firm that's currently paying: their Stripe subscription
  // would keep charging, but the webhook would skip the row as a comp.
  // (A cancelled firm keeps a 'stripe' row on Free; comping that is fine.)
  if (existing?.source === 'stripe' && existing.plan === 'pro') {
    throw new Error(`${org.name} already pays through Stripe. Cancel that first.`)
  }

  const note = arg ?? null
  await db
    .insert(orgPlans)
    .values({ orgId, plan: 'pro', source: 'comp', note })
    .onConflictDoUpdate({
      target: orgPlans.orgId,
      set: { plan: 'pro', source: 'comp', note, updatedAt: new Date() },
    })
  await setOrgSeatLimit(orgId, UNLIMITED_MEMBERS) // comped = no cap
  console.log(`Comped ${org.name} (${orgId}) to Pro.${note ? ` Note: ${note}` : ''}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err)
    process.exit(1)
  })