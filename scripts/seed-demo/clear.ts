// scripts/seed-demo/clear.ts
// Deletes every database row belonging to the demo firm, and nothing else.
// Clerk users are kept: they're stable, and recreating them would change their IDs.
import { eq, inArray } from 'drizzle-orm'
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
import { ORG_ID } from './config'

console.table({ORG_ID});


export async function clearDemo() {
  // One transaction: either every delete succeeds, or none of them happen.
  const counts = await db.transaction(async (tx) => {
    // The demo firm's case ids, for the one table without an org_id column.
    const demoMatters = tx
      .select({ id: matters.id })
      .from(matters)
      .where(eq(matters.orgId, ORG_ID))

    // Children before parents, so each count is accurate and no step
    // relies on a cascade happening somewhere else.
    const audit = await tx
      .delete(auditLogs)
      .where(eq(auditLogs.orgId, ORG_ID))
      .returning({ id: auditLogs.id })
    const qs = await tx
      .delete(queries)
      .where(eq(queries.orgId, ORG_ID))
      .returning({ id: queries.id })
    const chunks = await tx
      .delete(documents)
      .where(eq(documents.orgId, ORG_ID))
      .returning({ id: documents.id })
    const files = await tx
      .delete(documentFiles)
      .where(eq(documentFiles.orgId, ORG_ID))
      .returning({ id: documentFiles.id })
    const members = await tx
      .delete(matterMembers)
      .where(inArray(matterMembers.matterId, demoMatters))
      .returning({ id: matterMembers.id })
    const cases = await tx
      .delete(matters)
      .where(eq(matters.orgId, ORG_ID))
      .returning({ id: matters.id })
    const cls = await tx
      .delete(clients)
      .where(eq(clients.orgId, ORG_ID))
      .returning({ id: clients.id })
    // demo_usage only ever holds demo questions, so it's cleared in full.
    const usage = await tx.delete(demoUsage).returning({ id: demoUsage.id })

    return {
      audit_logs: audit.length,
      queries: qs.length,
      documents: chunks.length,
      document_files: files.length,
      matter_members: members.length,
      matters: cases.length,
      clients: cls.length,
      demo_usage: usage.length,
    }
  })

  console.log('Cleared demo firm rows:')
  console.table(counts)
}
