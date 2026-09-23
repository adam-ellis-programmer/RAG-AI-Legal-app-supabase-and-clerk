// app/app/matters/[id]/queries/[queryId]/page.tsx
// Shows a saved conversation: every turn that shares a thread_id, in order,
// with the one that was clicked highlighted. A colleague opening a follow-up
// can read what came before it rather than landing mid-conversation.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq, inArray, or } from 'drizzle-orm'
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

  // The clicked turn must belong to THIS case in THIS firm.
  const [clicked] = await db
    .select({ id: queries.id, threadId: queries.threadId })
    .from(queries)
    .where(and(eq(queries.id, queryId), eq(queries.matterId, id), eq(queries.orgId, orgId)))
    .limit(1)
  if (!clicked) notFound()

  // Every turn in the conversation. Older rows have no threadId, so they stand alone.
  const threadId = clicked.threadId
  const turns = await db
    .select()
    .from(queries)
    .where(
      and(
        eq(queries.matterId, id),
        eq(queries.orgId, orgId),
        threadId
          ? or(eq(queries.threadId, threadId), eq(queries.id, threadId))
          : eq(queries.id, queryId),
      ),
    )
    .orderBy(asc(queries.createdAt))

  // Look up the names and the ticked documents for every turn at once.
  const allFileIds = [...new Set(turns.flatMap((t) => t.fileIds))]
  const [files, members] = await Promise.all([
    allFileIds.length
      ? db
          .select({ id: documentFiles.id, source: documentFiles.source })
          .from(documentFiles)
          .where(and(eq(documentFiles.orgId, orgId), inArray(documentFiles.id, allFileIds)))
      : Promise.resolve([]),
    getOrgMembers(orgId),
  ])
  const fileNames = new Map(files.map((f) => [f.id, f.source]))
  const names = new Map(members.map((m) => [m.userId, m.name]))

  const first = turns[0]

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <Link href={`/app/matters/${id}`} className='text-sm text-slate-500 hover:text-slate-900'>
        &larr; {matter.title}
      </Link>

      <h1 className='mt-3 font-serif text-2xl text-slate-900'>{first.question}</h1>
      <p className='mt-1 text-sm text-slate-500'>
        {turns.length === 1
          ? `Asked by ${names.get(first.userId) ?? 'Former firm member'} · ${new Date(first.createdAt).toLocaleString()}`
          : `${turns.length} questions · started ${new Date(first.createdAt).toLocaleString()}`}
      </p>

      <div className='mt-8 space-y-10'>
        {turns.map((t, i) => {
          const anchor = `t${i}-`
          const isClicked = t.id === queryId
          const ticked = t.fileIds.map((fid) => fileNames.get(fid)).filter(Boolean)
          const missing = t.fileIds.length - ticked.length

          return (
            <article
              key={t.id}
              id={`turn-${t.id}`}
              className={`scroll-mt-20 space-y-3 ${isClicked && turns.length > 1 ? 'rounded-xl bg-amber-50/60 p-4 ring-1 ring-amber-200' : ''}`}
            >
              <div>
                <h2 className='text-sm font-medium text-slate-900'>
                  {i > 0 && <span className='mr-1 text-xs font-normal text-slate-400'>Follow-up:</span>}
                  {t.question}
                </h2>
                <p className='mt-1 text-xs text-slate-400'>
                  {names.get(t.userId) ?? 'Former firm member'} ·{' '}
                  {new Date(t.createdAt).toLocaleString()} · read from{' '}
                  {ticked.join(', ') || 'no documents'}
                  {missing > 0 && ` (and ${missing} since removed)`}
                </p>
              </div>

              {t.status === 'streaming' && (
                <p className='text-sm text-slate-500'>
                  This answer was still being written. Refresh in a moment.
                </p>
              )}
              {t.status === 'error' && (
                <p className='text-sm text-red-600'>
                  This answer didn&apos;t finish. Ask the question again from the case page.
                </p>
              )}

              {t.answer && <AnswerMarkdown text={t.answer} anchor={anchor} />}
              <SourceList sources={t.sources} anchor={anchor} />
            </article>
          )
        })}
      </div>
    </main>
  )
}