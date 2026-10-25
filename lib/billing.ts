// lib/billing.ts
// Makes org_plans match Stripe for one subscription. Used by the webhook and by
// the plan actions, so there's exactly one piece of code that turns Stripe's
// state into our state.
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orgPlans } from '@/lib/schema'
import { getStripe } from '@/lib/stripe'
import { setOrgSeatLimit } from './seats'
import { PLANS } from './plan'
// Statuses where the firm keeps Pro. 'past_due' = a renewal failed and Stripe is retrying.
const PRO_STATUSES: Stripe.Subscription.Status[] = [
  'active',
  'trialing',
  'past_due',
]

/** Stripe times are Unix seconds; JavaScript Dates use milliseconds. */
const toDate = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null

/**
 ** syncSubscription asks Stripe what a subscription looks like right
 ** now (active or ended, how many seats, when it renews, whether
 ** it’s been cancelled), then copies that answer into the firm’s org_plans row, so your app shows the same thing Stripe is actually charging for.
 */
export async function syncSubscription(subscriptionId: string) {
  // Always fetched fresh, so an old or repeated event can't write stale data.
  // Asks Stripe for the subscription as it is right now: its status, seats, dates, cancellation, everything
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)

  // console.log('LOGGED SUB: ', sub)

  // Which firm is this?
  const orgId = sub.metadata.orgId
  if (!orgId) {
    console.warn('Stripe subscription has no orgId metadata, ignoring', sub.id)
    return
  }

  // Look at the firm’s current row. If we gave this firm Pro for free with the comp script, Stripe must never overwrite that, so we stop.
  // Never let Stripe overwrite a firm we comped by hand.
  const [existing] = await db
    .select({
      source: orgPlans.source,
      subscriptionId: orgPlans.stripeSubscriptionId,
    })
    .from(orgPlans)
    .where(eq(orgPlans.orgId, orgId))
    .limit(1)

  // comped firm check
  if (existing?.source === 'comp') {
    console.warn('Firm is comped, ignoring Stripe event for', orgId)
    return
  }

  // Should this firm have Pro?
  const isPro = PRO_STATUSES.includes(sub.status)

  // Nothing to downgrade: don't create a Free row from a cancelled subscription.
  if (!isPro && !existing) return

  // An old subscription ending must not downgrade the firm's current one.
  if (!isPro && existing?.subscriptionId && existing.subscriptionId !== sub.id)
    return

  // A subscription can contain several products (“items”). Ours always has exactly one, CiteWise Pro, so we take the first. The seat count and period dates live on that item.
  const item = sub.items.data[0]

  // Translate Stripe’s answer into your columns:
  const values = {
    plan: isPro ? 'pro' : 'free',
    source: 'stripe',
    stripeCustomerId:
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    // The isPro ? … : null parts clear seats and dates when the firm isn’t Pro. toDate converts Stripe’s seconds into a JavaScript Date.
    seats: isPro ? (item?.quantity ?? null) : null,
    currentPeriodEnd: isPro ? toDate(item?.current_period_end) : null,
    cancelAt: isPro ? toDate(sub.cancel_at) : null,
    updatedAt: new Date(),
  }

  //  Save it. This is an “upsert”: insert a new row if the firm doesn’t have one; if it does (a “conflict” on orgId), update it with the same values instead.
  await db
    .insert(orgPlans)
    .values({ orgId, ...values })
    .onConflictDoUpdate({ target: orgPlans.orgId, set: values })

  // Keep Clerk's member limit in step with what they pay for
  /**
    * Why after the upsert: the database is the thing your app reads, 
    * so it’s written first. If the Clerk call fails, the function throws, 
    * the webhook returns 500, and Stripe retries, so the limit catches up.
    * 
    * Why the comp guard still matters: syncSubscription returns 
    * early for comped firms, so Stripe events can never shrink a 
    * comped firm’s limit.
   */
  await setOrgSeatLimit(
    orgId,
    isPro ? (item.quantity ?? PLANS.pro.includedSeats) : PLANS.free.maxMembers,
  )
}

/**
    Why call Stripe here at all?

    Both callers already have some information. The action knows what it just asked for, and the webhook event contains a copy of the subscription. But we ask Stripe again because:

    Stripe is the source of truth. It decides the real status, dates and cancel_at. Asking means we save what’s true, not what we think should be true.
    Webhook events can be old or arrive out of order. Stripe can deliver an older event after a newer one, or deliver the same event twice. If we saved the event’s own copy, an old event could overwrite newer data (e.g. bring back a cancellation you’d just undone). Fetching fresh every time means it doesn’t matter which event arrives when: we always save the current state.
    One function for every caller. The action, the webhook and (later) “Change seats” all just pass a subscription ID. None of them has to build the values themselves, so they can never disagree.
 */

/**
  * lib/billing.ts came in with the Cancel / Keep Pro step.
  * It exists so that one function, syncSubscription, can be used from two places.
  * 
  * 
  * Where it started, and why it had to move
  * In step 4, syncSubscription lived at the bottom of the webhook route, because the webhook was the only thing that needed it:

 */
