// scripts/reset-billing.ts
// TEST ONLY: put a firm back to plain Free.
// Deletes its Stripe customer (which cancels any subscription) and its org_plans row.
// npm run reset-billing -- org_abc123

// npm run reset-billing -- org_3HdTbMgxyvKdbNxOpSCxL8doBxT

import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orgPlans } from '@/lib/schema'

async function main() {
  const [orgId] = process.argv.slice(2)
  if (!orgId?.startsWith('org_'))
    throw new Error('Usage: npm run reset-billing -- <org_id>')

  // Safety: never run this against real customers.
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key.startsWith('sk_test_'))
    throw new Error('Refusing to run: STRIPE_SECRET_KEY is not a test key')

  const [row] = await db
    .select()
    .from(orgPlans)
    .where(eq(orgPlans.orgId, orgId))
    .limit(1)

  if (row?.stripeCustomerId) {
    // Deleting a customer cancels all their subscriptions immediately.
    await new Stripe(key).customers.del(row.stripeCustomerId)
    console.log(
      `Deleted Stripe customer ${row.stripeCustomerId} (and its subscriptions)`,
    )
  }

  await db.delete(orgPlans).where(eq(orgPlans.orgId, orgId))
  console.log(
    row
      ? `Removed ${row.source} plan row: ${orgId} is now on Free`
      : `${orgId} had no plan row: already Free`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err)
    process.exit(1)
  })
