// app/app/clients/page.tsx
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { clients, matters, matterMembers } from '@/lib/schema'
import { ViewSwitch } from '@/components/ViewSwitch'
import { createClient } from './actions'
import { SubmitButton } from '@/components/SubmitButton'
import { isDemoOrg } from '@/lib/demo'
import { db } from '@/lib/db'

export default async function ClientsPage() {
  const { orgId, userId } = await auth()

  if (!orgId || !userId) {
    return (
      <main className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='text-slate-600'>
          Select an organisation to manage clients.
        </p>
      </main>
    )
  }

  const isDemo = isDemoOrg(orgId)

  // Tenant wall (layer 1): only this firm's clients.
  // Tenant wall (layer 1): only this firm's clients.
  // Only the columns shown here: personal details stay on the client page,
  // where they're limited to people on one of that client's cases.
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      createdAt: clients.createdAt,
      // Counts only cases this person is on, so a walled-off case isn't even hinted at.
      caseCount: sql<number>`count(${matterMembers.id})::int`,
    })
    .from(clients)
    .leftJoin(matters, eq(matters.clientId, clients.id))
    .leftJoin(
      matterMembers,
      and(
        eq(matterMembers.matterId, matters.id),
        eq(matterMembers.userId, userId),
      ),
    )
    .where(eq(clients.orgId, orgId))
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt))

  const added = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  /**
  How the query works:
            -  leftJoin(matters, …) gives one row per client per case, and left keeps clients with no cases (they’d vanish with a normal join).
            -  The second leftJoin only matches when this user is on that case. On a walled case it matches nothing, so matterMembers.id is null.
            -  count(matterMembers.id) counts only non-null values, i.e. only cases you’re on. ::int makes Postgres return a number instead of a string (as in your billing sums).
            -  groupBy(clients.id) squashes it back to one row per client.
            -  'en-GB' in added: toLocaleDateString() with no locale uses the server’s setting. On Vercel that’s American, so you’d get 10/7/2026 instead of 7 Oct 2026.
     */
  return (
    <main className='mx-auto max-w-5xl px-6 py-10'>
      <div className='mb-8'>
        <h1 className='font-serif text-2xl text-slate-900'>Clients</h1>
        <p className='mt-1 text-sm text-slate-500'>
          {isDemo
            ? 'The demo firm’s clients. Open one to see its cases.'
            : 'Onboard a client, then open them to create a case.'}
        </p>
      </div>

      {/* Onboard-a-client form. `action={createClient}` submits straight to the
          server action — no fetch, no API route, no client JS. */}
      {!isDemo && (
        <form action={createClient} className='mb-8 flex gap-2'>
          <input
            name='name'
            required
            placeholder='Client name (e.g. Mr Johnson)'
            className='flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
          />
          <SubmitButton
            pendingText='Adding…'
            className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
          >
            Add client
          </SubmitButton>
        </form>
      )}

      {isDemo && (
        <p className='text-center mb-5 bg-gray-100 p-2 capitalize'>
          Create form hidden for demo users
        </p>
      )}

      {rows.length === 0 ? (
        <div className='rounded-xl border border-dashed border-slate-300 p-10 text-center'>
          <p className='text-slate-500'>No clients yet. Add your first above.</p>
        </div>
      ) : (
        <ViewSwitch storageKey='clients-view'>
          {/* Rows: a real table, hidden in grid view */}
          <div className='overflow-hidden rounded-xl border border-slate-200 group-data-[view=grid]:hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-left text-xs font-medium text-slate-500'>
                <tr>
                  <th className='px-4 py-2'>Client</th>
                  <th className='px-4 py-2 text-right'>Your cases</th>
                  <th className='px-4 py-2 text-right'>Added</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-200'>
                {rows.map((c) => (
                  <tr key={c.id} className='hover:bg-slate-50'>
                    <td className='px-4 py-3'>
                      <Link href={`/app/clients/${c.id}`} className='font-medium text-slate-900 hover:underline'>
                        {c.name}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-right tabular-nums text-slate-600'>{c.caseCount}</td>
                    <td className='px-4 py-3 text-right text-slate-400'>{added(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid: cards, hidden in rows view */}
          <ul className='hidden gap-3 group-data-[view=grid]:grid sm:grid-cols-2 lg:grid-cols-3'>
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/clients/${c.id}`}
                  className='block h-full rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50'
                >
                  <span className='font-medium text-slate-900'>{c.name}</span>
                  <span className='mt-2 block text-xs text-slate-500'>
                    {c.caseCount} {c.caseCount === 1 ? 'case' : 'cases'} · added {added(c.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </ViewSwitch>
      )}
    </main>
  )
}
