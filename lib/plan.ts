// lib/plan.ts
// The one place that decides what a firm's plan is and what it allows.
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orgPlans } from '@/lib/schema'

export const PLANS = {
  free: { label: 'Free', questionsPerMonth: 2 },
  // "Unlimited" in the marketing sense: a fair-use ceiling so one firm can't
  // run up an unbounded Anthropic/Voyage bill on a fixed monthly price.
  pro: { label: 'Pro', questionsPerMonth: 2000 },
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

/**
 *  keyof typeof PLANS builds the type from the object, the same trick as (typeof X)[number] in the seed. If you add a team plan later, the type updates itself.
 *  The === 'pro' ? 'pro' : 'free' line means anything unexpected in the database (a typo, or a plan name from the future) falls back to free. When code can’t be sure, it should give less access, not more.
 *  Why Pro has a cap: each question costs you real money in API calls. A fixed £X/month with truly no limit means one heavy firm could cost more than it pays. 2,000 is generous, and it’s easy to change.
 */
