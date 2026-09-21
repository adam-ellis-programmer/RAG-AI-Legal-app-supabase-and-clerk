// app/app/matters/[id]/queries/[queryId]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { queries, documentFiles } from '@/lib/schema'
import { getMatterAccess, getOrgMembers, isUuid } from '@/lib/matter-access'
import { AnswerMarkdown, SourceList } from '@/components/AnswerView'

export default async function SavedQueryPage({
  params,
}: {
  params: Promise<{ id: string; queryId: string }>
}) {
  const { id, queryId } = await params

  // Same walls as the case: firm, then case team. Non-members get a 404.
  const access = await getMatterAccess(id)
  if (!access || !isUuid(queryId)) notFound()
  const { orgId, matter } = access

  // The query must belong to THIS case in THIS firm.
  //   prettier-ignore
  const [q] = await db
    .select()
    .from(queries)
    .where(and(eq(queries.id, queryId), eq(queries.matterId, id), eq(queries.orgId, orgId)))
    .limit(1)
  if (!q) notFound()

  //   prettier-ignore
  const [ticked, members] = await Promise.all([
    q.fileIds.length
      ? db
          .select({ id: documentFiles.id, source: documentFiles.source })
          .from(documentFiles)
          .where(and(eq(documentFiles.orgId, orgId), inArray(documentFiles.id, q.fileIds)))
      : Promise.resolve([]),
    getOrgMembers(orgId),
  ])
  //   prettier-ignore
  const askedBy = members.find((m) => m.userId === q.userId)?.name ?? 'Former firm member'
  const missing = q.fileIds.length - ticked.length

  //   prettier-ignore
  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <Link href={`/app/matters/${id}`} className='text-sm text-slate-500 hover:text-slate-900'>
        &larr; {matter.title}
      </Link>

      <h1 className='mt-3 font-serif text-2xl text-slate-900'>{q.question}</h1>
      <p className='mt-1 text-sm text-slate-500'>
        Asked by {askedBy} · {new Date(q.createdAt).toLocaleString()}
      </p>

      <div className='mt-4 rounded-lg border border-slate-200 p-3 text-xs text-slate-500'>
        <span className='font-medium text-slate-700'>Read from: </span>
        {ticked.map((d) => d.source).join(', ') || 'no documents'}
        {missing > 0 && ` (and ${missing} since removed)`}
      </div>

      <div className='mt-6 space-y-4'>
        {q.status === 'streaming' && (
          <p className='text-sm text-slate-500'>
            This answer was still being written. Refresh in a moment.
          </p>
        )}
        {q.status === 'error' && (
          <p className='text-sm text-red-600'>
            This answer didn&apos;t finish. Ask the question again from the case page.
          </p>
        )}
        {q.answer && <AnswerMarkdown text={q.answer} />}
        <SourceList sources={q.sources} />
      </div>
    </main>
  )
}
