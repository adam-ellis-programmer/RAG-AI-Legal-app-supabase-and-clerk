// app/app/clients/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, matters, matterMembers } from '@/lib/schema'
import { createMatter } from './actions'
import { SubmitButton } from '@/components/SubmitButton'
import { isDemoOrg } from '@/lib/demo'
export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ archived?: string }>
}) {
  const { id } = await params
  const showArchived = (await searchParams).archived === '1'

  const { userId, orgId } = await auth()
  if (!userId || !orgId) notFound()
  const isDemo = isDemoOrg(orgId)
  // Layer 1 (firm wall): the client must belong to this org.
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.orgId, orgId)))
    .limit(1)
  if (!client) notFound()

  // Layer 2 (ethical wall): only list cases this user is on the team for.
  const cases = await db
    .select({
      id: matters.id,
      title: matters.title,
      status: matters.status,
      reference: matters.reference,
    })
    .from(matters)
    .innerJoin(
      matterMembers,
      and(
        eq(matterMembers.matterId, matters.id),
        eq(matterMembers.userId, userId),
      ),
    )
    .where(and(eq(matters.clientId, id), eq(matters.orgId, orgId)))
    .orderBy(desc(matters.createdAt))

  // ----- Filter after the cases query -----------
  const archivedCount = cases.filter((c) => c.status === 'archived').length
  // prettier-ignore
  const visibleCases = showArchived ? cases : cases.filter((c) => c.status !== 'archived')

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-8'>
        <Link
          href='/app/clients'
          className='text-sm text-slate-500 hover:text-slate-900'
        >
          &larr; All clients
        </Link>
        <h1 className='mt-2 font-serif text-2xl text-slate-900'>
          {client.name}
        </h1>
        <p className='mt-1 text-sm text-slate-500'>Cases for this client.</p>
      </div>

      {/* Create-a-case form. The hidden clientId tells the action which client
          this case belongs to (validated server-side in the action). */}

      {!isDemo && (
        <form
          action={createMatter}
          className='mb-8 space-y-2 rounded-xl border border-slate-200 p-4'
        >
          <input type='hidden' name='clientId' value={client.id} />
          <input
            name='title'
            required
            placeholder='Case title (e.g. Johnson vs Smith – boundary dispute 2026)'
            className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
          />
          <input
            name='reference'
            placeholder='Reference (optional, e.g. MAT-2026-001)'
            className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
          />
          <SubmitButton
            pendingText='Creating…'
            className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
          >
            Create case
          </SubmitButton>
        </form>
      )}

      {visibleCases.length === 0 ? (
        <div className='rounded-xl border border-dashed border-slate-300 p-10 text-center'>
          <p className='text-slate-500'>
            {archivedCount > 0
              ? `No open or closed cases for ${client.name}.`
              : `No cases yet for ${client.name}.`}
          </p>
        </div>
      ) : (
        <ul className='space-y-2'>
          {visibleCases.map((m) => (
            <li key={m.id}>
              <Link
                href={`/app/matters/${m.id}`}
                className='block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50'
              >
                <div className='flex items-center justify-between'>
                  <span className='font-medium text-slate-900'>{m.title}</span>
                  <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
                    {m.status}
                  </span>
                </div>
                {m.reference && (
                  <span className='mt-1 block text-xs text-slate-400'>
                    {m.reference}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archivedCount > 0 &&
        // prettier-ignore
        <p className='mt-4 text-xs text-slate-500'>
          <Link href={showArchived ? `/app/clients/${id}` : `/app/clients/${id}?archived=1`} className='underline'>
            {showArchived ? 'Hide archived cases' : `Show ${archivedCount} archived case${archivedCount === 1 ? '' : 's'}`}
          </Link>
        </p>}
    </main>
  )
}
