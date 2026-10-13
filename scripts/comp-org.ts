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

async function main() {
  const [orgId, arg] = process.argv.slice(2)
  if (!orgId?.startsWith('org_')) {
    throw new Error('Usage: npm run comp-org -- <org_id> ["note" | --remove]')
  }

  // Look the firm up in Clerk first, so a typo in the ID fails loudly
  // instead of silently comping a firm that doesn't exist.
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  const org = await clerk.organizations.getOrganization({
    organizationId: orgId,
  })

  const [existing] = await db
    .select()
    .from(orgPlans)
    .where(eq(orgPlans.orgId, orgId))
    .limit(1)

  if (arg === '--remove') {
    const removed = await db
      .delete(orgPlans)
      .where(and(eq(orgPlans.orgId, orgId), eq(orgPlans.source, 'comp')))
      .returning({ orgId: orgPlans.orgId })
    //   prettier-ignore
    console.log(removed.length ? `Removed comp from ${org.name}: back on Free.` : `${org.name} has no comp to remove.`)
    return
  }

  // Never overwrite a paying firm: their Stripe subscription would keep
  // charging, but the webhook would no longer recognise the row as Stripe's.
  if (existing?.source === 'stripe') {
    throw new Error(
      `${org.name} already pays through Stripe. Cancel that first.`,
    )
  }

  const note = arg ?? null
  await db
    .insert(orgPlans)
    .values({ orgId, plan: 'pro', source: 'comp', note })
    .onConflictDoUpdate({
      target: orgPlans.orgId,
      set: { plan: 'pro', source: 'comp', note, updatedAt: new Date() },
    })
  console.log(
    `Comped ${org.name} (${orgId}) to Pro.${note ? ` Note: ${note}` : ''}`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err)
    process.exit(1)
  })
