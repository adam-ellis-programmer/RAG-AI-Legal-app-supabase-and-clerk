// lib/firm-quota.ts
// Free-tier allowance for real firms: a fixed number of questions per calendar month.
// When payments arrive, FREE_QUESTIONS_PER_MONTH becomes "this firm's plan limit".
import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { questionUsage } from '@/lib/schema'
import { getOrgPlan, PLANS } from '@/lib/plan'

export const FREE_QUESTIONS_PER_MONTH = PLANS.free.questionsPerMonth

// Firms that are never limited (e.g. your own), as a comma-separated env list.
const UNLIMITED = new Set(
  (process.env.UNLIMITED_ORG_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

/** Midnight UTC on the 1st of the current month. */
function startOfMonth() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/**
 * Try to use one of this firm's questions. Returns null if allowed (and records it),
 * or a message explaining why not.
 *
 *
 * Calendar month, not "the last 30 days". That's how plans normally work, and it gives a clear message: "resets on the 1st". The demo uses a rolling 24 hours because it has no billing period
 *
 *  For a free allowance that doesn't matter. A billing system would use a database lock or counter instead.
 */
// prettier-ignore

// The if (!UNLIMITED.has(orgId)) wrapper is gone:
// every firm is now counted against its own plan’s limit.
// A comped firm is just a firm on Pro.

export async function claimFirmQuestion(
  orgId: string,
  userId: string,
  route: 'chat' | 'case-query',
): Promise<string | null> {
  const plan = await getOrgPlan(orgId)
  const limit = PLANS[plan].questionsPerMonth

  const [{ n }] = await db
    .select({ n: count() })
    .from(questionUsage)
    .where(and(eq(questionUsage.orgId, orgId), gte(questionUsage.createdAt, startOfMonth())))

  if (n >= limit) {
    return plan === 'free'
      ? `Your firm has used its ${limit} free questions this month. Upgrade to Pro, or wait for the allowance to reset on the 1st.`
      : `Your firm has reached the Pro fair-use limit of ${limit} questions this month. It resets on the 1st.`
  }

  await db.insert(questionUsage).values({ orgId, userId, route })
  return null
}
