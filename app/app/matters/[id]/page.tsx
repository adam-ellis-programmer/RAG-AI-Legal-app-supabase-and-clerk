// app/app/matters/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { CaseQuery } from '@/components/CaseQuery'

import { clients, matterMembers, documentFiles } from '@/lib/schema'
import { CaseUpload } from '@/components/CaseUpload'
// Ethical and firm wall
import { getMatterAccess, getOrgMembers } from '@/lib/matter-access'
import { addMatterMember, removeMatterMember } from './actions'
import { SubmitButton } from '@/components/SubmitButton'

export default async function MatterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Layer 1 (firm) + Layer 2 (case team) — non-members get a 404.
  const access = await getMatterAccess(id)
  if (!access) notFound()
  const { userId, orgId, matter, membership } = access
  const isAdmin = membership.role === 'admin'

  // prettier-ignore
  const [[client], team, orgMembers, caseDocs, lawBooks] = await Promise.all([
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
  ])

  const byUserId = new Map(orgMembers.map((m) => [m.userId, m]))
  const adminCount = team.filter((m) => m.role === 'admin').length

  const sortedTeam = [...team].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1,
  )
  // Firm members not already on this case — the "add" dropdown options.
  // *** two loops *** ??? one nested -> for loop equivalent
  const candidates = orgMembers.filter(
    (m) => !team.some((t) => t.userId === m.userId),
  )
  console.log(orgMembers)

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-8'>
        <Link
          href={`/app/clients/${matter.clientId}`}
          className='text-sm text-slate-500 hover:text-slate-900'
        >
          &larr; {client?.name ?? 'Client'}
        </Link>
        <div className='mt-2 flex items-center gap-3 '>
          <h1 className='font-serif text-2xl text-slate-900'>{matter.title}</h1>
          <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
            {matter.status}
          </span>
        </div>
        {matter.reference && (
          <p className='mt-1 text-sm text-slate-400'>{matter.reference}</p>
        )}
      </div>

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
                        <button
                          type='submit'
                          className='rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50'
                        >
                          Remove
                        </button>
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
            <CaseUpload matterId={matter.id} />
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
                <li key={doc.id}>
                  <Link
                    href={`/app/documents/${doc.id}`}
                    className='flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50'
                  >
                    <span className='font-medium text-slate-900'>
                      {doc.source}
                    </span>
                    <span className='text-xs text-slate-400'>
                      {byUserId.get(doc.uploadedBy ?? '')?.name ?? 'Unknown'} ·{' '}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ask about this case — tick case files + law books */}
        {/* prettier-ignore */}
        <section className='mt-8'>
        <h2 className='mb-3 text-sm font-semibold text-slate-700'>Ask about this case</h2>
        <CaseQuery
          matterId={matter.id}
          caseDocs={caseDocs.map((d) => ({ id: d.id, source: d.source }))}
          lawBooks={lawBooks}
        />
      </section>
      </div>
    </main>
  )
}
