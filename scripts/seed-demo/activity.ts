// scripts/seed-demo/activity.ts
// Stage 5: the audit trail behind the Case activity panel.
// Every entry is derived from what the earlier stages actually created, using the
// same action names and detail formats as the real server actions, so seeded rows
// and rows written by real visitors look identical side by side.
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/schema'
import { ORG_ID, daysAgo } from './config'
import { PEOPLE, type People, type PersonKey } from './people'
import { CASES, type Cases } from './cases'
import type { SavedQuery } from './conversations'

type AuditRow = typeof auditLogs.$inferInsert

// "Eleanor Wakefield", etc. Stored as the name snapshot, like logAction does.
const NAMES = Object.fromEntries(
  PEOPLE.map((p) => [p.key, `${p.firstName} ${p.lastName}`]),
) as Record<PersonKey, string>

/** A date n days ago at a given time of day. */
function at(days: number, hour: number, minute = 0) {
  const d = daysAgo(days, hour)
  d.setMinutes(minute)
  return d
}

// prettier-ignore
export async function seedActivity(people: People, cases: Cases, convos: SavedQuery[]) {
  const rows: AuditRow[] = []

  function log(
    who: PersonKey,
    matterId: string,
    action: string,
    createdAt: Date,
    target: { type: string; id: string },
    detail: string,
  ) {
    rows.push({
      orgId: ORG_ID,
      matterId,
      userId: people[who],
      userName: NAMES[who],
      action,
      targetType: target.type,
      targetId: target.id,
      detail,
      createdAt,
    })
  }

  for (const spec of CASES) {
    const c = cases[spec.key]

    // 1. The case is opened, and its creator builds the team.
    //    (The creator is added automatically, so like createMatter, no entry for them.)
    log(spec.createdBy, c.id, 'matter.created', at(spec.daysAgo, 10, 0), { type: 'matter', id: c.id }, spec.title)
    spec.team.forEach((m, i) => {
      if (m.person === spec.createdBy) return
      log(spec.createdBy, c.id, 'member.added', at(spec.daysAgo, 10, 5 + i * 3),
        { type: 'member', id: people[m.person] }, `${NAMES[m.person]} (${m.role})`)
    })

    // 2. Each document is uploaded, then read by the team over the following days.
    //    The demo visitor gets no seeded history: their entries appear live as they browse.
    const readers = spec.team.filter((m) => m.person !== 'visitor')
    spec.docs.forEach((d, i) => {
      const doc = c.docs[d.key]
      log(d.uploadedBy, c.id, 'document.uploaded', at(d.daysAgo, 10, 0), { type: 'document', id: doc.id }, doc.source)
      readers.forEach((r, j) => {
        const day = Math.max(1, d.daysAgo - 1 - j * 2)
        log(r.person, c.id, 'document.view', at(day, 11 + j * 2, 15 + i * 7), { type: 'document', id: doc.id }, doc.source)
      })
    })
  }

  // 3. Each saved question, then the asker opening the case documents it cited.
  //    Law books are left out: their views have no matter_id, so they never
  //    appear in a case's activity anyway.
  const caseDoc = new Map<string, { source: string }>()
  for (const c of Object.values(cases)) {
    for (const d of Object.values(c.docs)) caseDoc.set(d.id, d)
  }
  const keyOf = new Map(Object.entries(people).map(([key, id]) => [id, key as PersonKey]))

  for (const q of convos) {
    const who = keyOf.get(q.userId)
    if (!who) continue
    log(who, q.matterId, 'query.ask', q.createdAt, { type: 'query', id: q.id }, q.question)

    q.citedFileIds.forEach((fileId, i) => {
      const doc = caseDoc.get(fileId)
      if (!doc) return
      const opened = new Date(q.createdAt.getTime() + (8 + i * 4) * 60_000) // 8, 12, 16… minutes later
      log(who, q.matterId, 'document.view', opened, { type: 'document', id: fileId }, doc.source)
    })
  }

  await db.insert(auditLogs).values(rows)
  console.log(`  ${rows.length} activity entries across ${CASES.length} cases`)
}