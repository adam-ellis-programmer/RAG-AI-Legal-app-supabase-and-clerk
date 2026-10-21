// lib/plan.ts
// The one place that decides what a firm's plan is and what it allows.
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orgPlans } from '@/lib/schema'

export const PLANS = {
  free: { label: 'Free', questionsPerMonth: 50 },
  // "Unlimited" in the marketing sense: a fair-use ceiling so one firm can't
  // run up an unbounded Anthropic/Voyage bill on a fixed monthly price.
  pro: {
    label: 'Pro',
    questionsPerMonth: 2000,
    includedSeats: 5, // must match tier 1 of the Stripe price
    flatFeePence: 12000, // tier 1 flat fee (£120)
    extraSeatPence: 1000, // tier 2 price per extra seat (£10)
    priceText: '£120 a month for up to 5 people, then £10 per extra person',
  },

  // These are only for showing the price on your page.
  // Stripe still does the real charging from its own price.
  // As with includedSeats, keep them in step with Stripe if you ever change the price.
} as const

export type Plan = keyof typeof PLANS // 'free' | 'pro'

export async function getOrgPlan(orgId: string): Promise<Plan> {
  const [row] = await db
    .select({ plan: orgPlans.plan })
    .from(orgPlans)
    .where(eq(orgPlans.orgId, orgId))
    .limit(1)
  return row?.plan === 'pro' ? 'pro' : 'free'
}

//
// getOrgPlan stays as it is, because the question cap only needs the plan name. This one is for pages that need everything.
// Everything about a firm's plan, for the Plan page and checkout
// includedSeats and priceText repeat what’s in Stripe, so if you ever change the Stripe price, update these too. The comment on includedSeats is there to remind you.
// prettier-ignore
export async function getOrgPlanDetails(orgId: string) {
  const [row] = await db.select().from(orgPlans).where(eq(orgPlans.orgId, orgId)).limit(1)
  return {
    plan: (row?.plan === 'pro' ? 'pro' : 'free') as Plan,
    source: row?.source ?? null, // 'stripe' | 'comp' | null
    seats: row?.seats ?? null,
    stripeCustomerId: row?.stripeCustomerId ?? null,

    stripeSubscriptionId: row?.stripeSubscriptionId ?? null,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    cancelAt: row?.cancelAt ?? null,
  }
}

/**
 *  keyof typeof PLANS builds the type from the object, the same trick as (typeof X)[number] in the seed. If you add a team plan later, the type updates itself.
 *  The === 'pro' ? 'pro' : 'free' line means anything unexpected in the database (a typo, or a plan name from the future) falls back to free. When code can’t be sure, it should give less access, not more.
 *  Why Pro has a cap: each question costs you real money in API calls. A fixed £X/month with truly no limit means one heavy firm could cost more than it pays. 2,000 is generous, and it’s easy to change.
 */
