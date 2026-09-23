// app/app/matters/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { CaseQuery } from '@/components/CaseQuery'
// prettier-ignore
import { clients, matterMembers, documentFiles, queries, auditLogs } from '@/lib/schema'
import { CaseUpload } from '@/components/CaseUpload'
// prettier-ignore
import { CaseActivity, ACTIVITY_FILTERS, type ActivityFilter } from '@/components/CaseActivity'

// Ethical and firm wall
import { getMatterAccess, getOrgMembers } from '@/lib/matter-access'
import {
  addMatterMember,
  removeMatterMember,
  changeMemberRole,
  setMatterStatus,
} from './actions'
import { SubmitButton } from '@/components/SubmitButton'

import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { deleteDocument } from '@/app/app/documents/actions'

// The page now reads a search param for the filter (changed function signature)
export default async function MatterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ activity?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  // Layer 1 (firm) + Layer 2 (case team) — non-members get a 404.
  const access = await getMatterAccess(id)
  if (!access) notFound()
  const { userId, orgId, matter, membership } = access

  const isAdmin = membership.role === 'admin'
  const isOpen = matter.status === 'open'

  // prettier-ignore
  const [[client], team, orgMembers, caseDocs, lawBooks, history] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, matter.clientId)).limit(1),
    db.select().from(matterMembers).where(eq(matterMembers.matterId, id)),
    getOrgMembers(orgId),
    db
      .select({
        id: documentFiles.id,
        source: documentFiles.source,
        uploadedBy: documentFiles.uploadedBy,
        createdAt: documentFiles.createdAt,
      })
      .from(documentFiles)
      .where(and(eq(documentFiles.matterId, id), eq(documentFiles.orgId, orgId)))
      .orderBy(desc(documentFiles.createdAt)),
    db
      .select({ id: documentFiles.id, source: documentFiles.source })
      .from(documentFiles)
      .where(and(eq(documentFiles.orgId, orgId), isNull(documentFiles.matterId)))
      .orderBy(documentFiles.source),
      // added in ...
      db
      .select({
        id: queries.id,
        threadId: queries.threadId,  
        question: queries.question,
        userId: queries.userId,
        status: queries.status,
        createdAt: queries.createdAt,
      })
      .from(queries)
      .where(and(eq(queries.matterId, id), eq(queries.orgId, orgId)))
      .orderBy(desc(queries.createdAt))
      .limit(20),
  ])

  const byUserId = new Map(orgMembers.map((m) => [m.userId, m])) // ← existing, keep

  // Case activity: admins only. Pick the filter from the URL, defaulting to all.
  const filter: ActivityFilter =
    sp.activity && sp.activity in ACTIVITY_FILTERS
      ? (sp.activity as ActivityFilter)
      : 'all'
  const filterActions = ACTIVITY_FILTERS[filter]

  const activity = isAdmin
    ? await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userName: auditLogs.userName,
          action: auditLogs.action,
          targetType: auditLogs.targetType,
          targetId: auditLogs.targetId,
          detail: auditLogs.detail,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(
          // and() skips undefined, which is how "All" adds no filter.
          and(
            eq(auditLogs.matterId, id),
            eq(auditLogs.orgId, orgId),
            filterActions
              ? inArray(auditLogs.action, [...filterActions])
              : undefined,
          ),
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(50)
    : []

  const names = Object.fromEntries(orgMembers.map((m) => [m.userId, m.name]))

  const adminCount = team.filter((m) => m.role === 'admin').length

  const sortedTeam = [...team].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1,
  )
  // Firm members not already on this case — the "add" dropdown options.
  // *** two loops *** ??? one nested -> for loop equivalent
  const candidates = orgMembers.filter(
    (m) => !team.some((t) => t.userId === m.userId),
  )


  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-8'>
        <Link
          href={`/app/clients/${matter.clientId}`}
          className='text-sm text-slate-500 hover:text-slate-900'
        >
          &larr; {client?.name ?? 'Client'}
        </Link>

        <div className='mt-2 flex flex-wrap items-center gap-3'>
          <h1 className='font-serif text-2xl text-slate-900'>{matter.title}</h1>
          {/* prettier-ignore */}
          <span className={`rounded-full px-2 py-0.5 text-xs ${isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {matter.status}
          </span>

          {isAdmin &&
            // prettier-ignore
            <div className='ml-auto flex gap-1'>
              {(isOpen
                ? [['closed', 'Close case'], ['archived', 'Archive']]
                : matter.status === 'closed'
                  ? [['open', 'Reopen'], ['archived', 'Archive']]
                  : [['open', 'Reopen']]
              ).map(([status, label]) => (
                <form key={status} action={setMatterStatus}>
                  <input type='hidden' name='matterId' value={matter.id} />
                  <input type='hidden' name='status' value={status} />
                  <SubmitButton pendingText='Saving…' className='rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50'>
                    {label}
                  </SubmitButton>
                </form>
              ))}
            </div>}
        </div>

        {matter.reference && (
          <p className='mt-1 text-sm text-slate-400'>{matter.reference}</p>
        )}
      </div>
      {!isOpen &&
        // prettier-ignore
        <p className='mb-8 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200'>
          This case is {matter.status}. Its documents and research history stay readable, but
          uploads and new questions are switched off.
          {isAdmin ? ' Reopen it to continue working.' : ' A case admin can reopen it.'}
        </p>}
      {/* Case team */}
      <div className=''>
        <section className='mb-8'>
          <h2 className='mb-3 text-sm font-semibold text-slate-700'>
            Case team{' '}
            <span className='font-normal text-slate-400'>({team.length})</span>
          </h2>

          <ul className='space-y-1 text-sm'>
            {sortedTeam.map((member) => {
              const person = byUserId.get(member.userId)
              const isLastAdmin = member.role === 'admin' && adminCount <= 1
              return (
                <li
                  key={member.id}
                  className='flex items-center justify-between rounded-md border border-slate-200 px-3 py-2'
                >
                  <div>
                    <span className='font-medium text-slate-900'>
                      {person?.name ?? 'Former firm member'}
                      {member.userId === userId && (
                        <span className='ml-1 font-normal text-slate-400'>
                          (you)
                        </span>
                      )}
                    </span>
                    <span className='block text-xs text-slate-400'>
                      {person?.email ?? member.userId}
                    </span>
                  </div>

                  <div className='flex items-center gap-2'>
                    <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
                      {member.role}
                    </span>

                    {isAdmin && (member.role === 'member' || !isLastAdmin) && (
                      <form action={changeMemberRole}>
                        <input
                          type='hidden'
                          name='matterId'
                          value={matter.id}
                        />
                        <input
                          type='hidden'
                          name='memberId'
                          value={member.id}
                        />
                        <input
                          type='hidden'
                          name='role'
                          value={member.role === 'admin' ? 'member' : 'admin'}
                        />
                        <SubmitButton
                          pendingText='Saving…'
                          className='rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100'
                        >
                          {member.role === 'admin'
                            ? 'Make member'
                            : 'Make admin'}
                        </SubmitButton>
                      </form>
                    )}

                    {/* restored: remove from the case (the last admin can't be removed) */}
                    {isAdmin && !isLastAdmin && (
                      <form action={removeMatterMember}>
                        <input
                          type='hidden'
                          name='matterId'
                          value={matter.id}
                        />
                        <input
                          type='hidden'
                          name='memberId'
                          value={member.id}
                        />
                        <SubmitButton
                          pendingText='Removing…'
                          className='rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50'
                        >
                          Remove
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Add member — admins only */}
          {isAdmin &&
            (candidates.length === 0 ? (
              <p className='mt-3 text-xs text-slate-400'>
                Everyone in the firm is already on this case.
              </p>
            ) : (
              <form
                action={addMatterMember}
                className='mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3'
              >
                <input type='hidden' name='matterId' value={matter.id} />
                <select
                  name='userId'
                  required
                  defaultValue=''
                  className='min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm'
                >
                  <option value='' disabled>
                    Add a firm member…
                  </option>
                  {candidates.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name} — {c.email}
                    </option>
                  ))}
                </select>
                <select
                  name='role'
                  defaultValue='member'
                  className='rounded-md border border-slate-300 px-3 py-2 text-sm'
                >
                  <option value='member'>member</option>
                  <option value='admin'>admin</option>
                </select>
                <SubmitButton
                  pendingText='Adding…'
                  className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
                >
                  Add to case
                </SubmitButton>
              </form>
            ))}
        </section>
        {/* Case documents — visible to the case team only */}
        <section>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-slate-700'>
              Case documents{' '}
              <span className='font-normal text-slate-400'>
                ({caseDocs.length})
              </span>
            </h2>
            {isOpen && <CaseUpload matterId={matter.id} />}
          </div>

          {caseDocs.length === 0 ? (
            <div className='rounded-xl border border-dashed border-slate-300 p-8 text-center'>
              <p className='text-slate-500'>No documents on this case yet.</p>
              <p className='mt-1 text-xs text-slate-400'>
                Upload the client&apos;s files (deeds, contracts,
                correspondence) as PDFs.
              </p>
            </div>
          ) : (
            <ul className='space-y-2'>
              {caseDocs.map((doc) => (
                // prettier-ignore (*** UTH ***)
                <li
                  key={doc.id}
                  className='flex items-center gap-2 rounded-xl border border-slate-200 transition hover:border-slate-300'
                >
                  <Link
                    href={`/app/documents/${doc.id}`}
                    prefetch={false}
                    className='flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl p-4 hover:bg-slate-50'
                  >
                    <span className='truncate font-medium text-slate-900'>
                      {doc.source}
                    </span>
                    <span className='shrink-0 text-xs text-slate-400'>
                      {byUserId.get(doc.uploadedBy ?? '')?.name ?? 'Unknown'} ·{' '}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                  {isAdmin && (
                    <form action={deleteDocument} className='pr-3'>
                      <input type='hidden' name='fileId' value={doc.id} />
                      <ConfirmSubmitButton
                        message={`Delete "${doc.source}" from this case? Its passages will no longer be searchable. This can't be undone.`}
                        pendingText='Deleting…'
                        className='rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50'
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        {/* Ask about this case — tick case files + law books */}
        {/* prettier-ignore */}
        {/* Ask about this case — tick case files + law books */}
        {isOpen && (
          <section className='mt-8'>
            <h2 className='mb-3 text-sm font-semibold text-slate-700'>
              Ask about this case
            </h2>
            <CaseQuery
              matterId={matter.id}
              caseDocs={caseDocs.map((d) => ({ id: d.id, source: d.source }))}
              lawBooks={lawBooks}
            />
          </section>
        )}
        {/* Research history — saved questions and answers for the whole team */}
        {/* prettier-ignore */}
        <section className='mt-8'>
          <h2 className='mb-3 text-sm font-semibold text-slate-700'>
            Research history{' '}
          <span className='font-normal text-slate-400'>({history.length})</span>
        </h2>
        {history.length === 0 ? (
          <p className='text-sm text-slate-500'>
            Questions asked on this case will be saved here for the whole team.
          </p>
        ) : (
          <ul className='space-y-2'>
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/app/matters/${id}/queries/${h.id}#turn-${h.id}`} className='block rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50'>
                  <span className='line-clamp-2 text-sm text-slate-900'>
                    {h.threadId && h.threadId !== h.id && (
                      <span className='mr-1 text-xs text-slate-400'>Follow-up:</span>
                    )}
                    {h.question}
                  </span>
                  <span className='mt-1 block text-xs text-slate-400'>
                    {byUserId.get(h.userId)?.name ?? 'Former firm member'} ·{' '}
                    {new Date(h.createdAt).toLocaleString()}
                    {h.status !== 'complete' && ` · ${h.status === 'error' ? 'failed' : 'unfinished'}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>{' '}
        {/* ← end of Research history, keep */}
        {/* Case activity — case admins only */}
        {isAdmin &&
          // prettier-ignore
          <section id='activity' className='mt-8 scroll-mt-6'>
          <h2 className='mb-1 text-sm font-semibold text-slate-700'>Case activity</h2>
          <p className='mb-3 text-xs text-slate-500'>
            Who opened, uploaded and asked what on this case. Visible to case admins only.
          </p>
          {/* prettier-ignore */}
          <CaseActivity matterId={id} entries={activity} names={names} filter={filter} />
        </section>}
      </div>{' '}
      {/* ← existing, keep */}
    </main>
  )
}
