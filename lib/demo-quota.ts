// lib/demo-quota.ts
// Question limits for the shared demo firm: a fair share per visitor (by IP)
// and a hard daily ceiling to protect the API bill.
import { createHash } from 'node:crypto'
import { and, count, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { demoUsage } from '@/lib/schema'

export const PER_IP_PER_DAY = 2
export const DEMO_PER_DAY = 150
const DAY_MS = 24 * 60 * 60 * 1000

// On Vercel, the first address in x-forwarded-for is the visitor.
// Locally there's no proxy, so everything counts as one visitor.
function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  return (
    forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  )
}

// Store a salted hash, never the IP itself.
function hashIp(ip: string) {
  return createHash('sha256')
    .update(`${process.env.DEMO_IP_SALT ?? ''}:${ip}`)
    .digest('hex')
}

/**
 * Try to use one demo question. Returns null if allowed (and records it),
 * or a message explaining why not.
 */
export async function claimDemoQuestion(
  req: Request,
  route: 'chat' | 'case-query',
): Promise<string | null> {
  const ipHash = hashIp(clientIp(req))
  const since = new Date(Date.now() - DAY_MS)

  const [[mine], [everyone]] = await Promise.all([
    db
      .select({ n: count() })
      .from(demoUsage)
      .where(and(eq(demoUsage.ipHash, ipHash), gt(demoUsage.createdAt, since))),
    db
      .select({ n: count() })
      .from(demoUsage)
      .where(gt(demoUsage.createdAt, since)),
  ])

  if (mine.n >= PER_IP_PER_DAY) {
    return `You've asked ${PER_IP_PER_DAY} questions today, the demo's daily limit. You can still open the cases and explore their saved answers and citations.`
  }
  if (everyone.n >= DEMO_PER_DAY) {
    return 'The demo has reached its question limit for today. Please try again tomorrow; the saved answers are still there to explore.'
  }

  await db.insert(demoUsage).values({ ipHash, route })
  return null
}
