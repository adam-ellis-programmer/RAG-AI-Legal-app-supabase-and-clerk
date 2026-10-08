// app/api/cron/reset-demo/route.ts
// Nightly demo reset, called by Vercel Cron.
// 1. Removes what visitors created (their questions and activity). The seed never
//    writes as the demo visitor, so everything seeded is left alone.
// 2. Clears old question-limit rows.
// 3. Moves every demo timestamp forward so the seeded history never ages.
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  auditLogs,
  clients,
  demoUsage,
  documentFiles,
  documents,
  matterMembers,
  matters,
  queries,
} from '@/lib/schema'
import { DEMO_ORG_ID } from '@/lib/demo'

// The newest seeded entry (Priya's follow-up) is seeded about 9 days ago.
const NEWEST_SEEDED_DAYS_AGO = 9

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const visitorId = process.env.DEMO_USER_ID
  // Never run with an empty org or user id: every delete below depends on them.
  if (!DEMO_ORG_ID || !visitorId) {
    return Response.json({ error: 'Demo is not configured.' }, { status: 500 })
  }

  const result = await db.transaction(async (tx) => {
    // ---- 1. What visitors created ----
    const removedQueries = await tx
      .delete(queries)
      .where(and(eq(queries.orgId, DEMO_ORG_ID), eq(queries.userId, visitorId)))
      .returning({ id: queries.id })

    const removedActivity = await tx
      .delete(auditLogs)
      .where(
        and(eq(auditLogs.orgId, DEMO_ORG_ID), eq(auditLogs.userId, visitorId)),
      )
      .returning({ id: auditLogs.id })

    // ---- 2. Question-limit rows older than the 24-hour window ----
    const removedUsage = await tx
      .delete(demoUsage)
      .where(lt(demoUsage.createdAt, sql`now() - interval '1 day'`))
      .returning({ id: demoUsage.id })

    // ---- 3. Keep the seeded history the same age ----
    const [{ newest }] = await tx
      .select({ newest: sql<Date | null>`max(${auditLogs.createdAt})` })
      .from(auditLogs)
      .where(eq(auditLogs.orgId, DEMO_ORG_ID))

    let shiftedHours = 0
    // prettier-ignore
    if (newest) {
      const target = Date.now() - NEWEST_SEEDED_DAYS_AGO * 24 * 60 * 60 * 1000
      const shiftMs = target - new Date(newest).getTime()

      if (shiftMs > 60 * 60 * 1000) {
        // Only move forward, and only if it's worth it (more than an hour).
        const by = sql`make_interval(secs => ${shiftMs / 1000}::double precision)`
        const demoMatters = tx.select({ id: matters.id }).from(matters).where(eq(matters.orgId, DEMO_ORG_ID))

        await tx.update(clients).set({ createdAt: sql`${clients.createdAt} + ${by}` }).where(eq(clients.orgId, DEMO_ORG_ID))
        await tx.update(matters).set({ createdAt: sql`${matters.createdAt} + ${by}` }).where(eq(matters.orgId, DEMO_ORG_ID))
        await tx.update(matterMembers).set({ addedAt: sql`${matterMembers.addedAt} + ${by}` }).where(inArray(matterMembers.matterId, demoMatters))
        await tx.update(documentFiles).set({ createdAt: sql`${documentFiles.createdAt} + ${by}` }).where(eq(documentFiles.orgId, DEMO_ORG_ID))
        await tx.update(documents).set({ createdAt: sql`${documents.createdAt} + ${by}` }).where(eq(documents.orgId, DEMO_ORG_ID))
        await tx.update(queries).set({ createdAt: sql`${queries.createdAt} + ${by}` }).where(eq(queries.orgId, DEMO_ORG_ID))
        await tx.update(auditLogs).set({ createdAt: sql`${auditLogs.createdAt} + ${by}` }).where(eq(auditLogs.orgId, DEMO_ORG_ID))

        shiftedHours = Math.round(shiftMs / 3_600_000)
      }
    }

    return {
      removedQueries: removedQueries.length,
      removedActivity: removedActivity.length,
      removedUsage: removedUsage.length,
      shiftedHours,
    }
  })

  console.log('demo reset:', result)
  return Response.json({ ok: true, ...result })
}
