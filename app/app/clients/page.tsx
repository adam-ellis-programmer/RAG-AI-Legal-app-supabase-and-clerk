// app/app/clients/page.tsx
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients } from '@/lib/schema'
import { createClient } from './actions'
import { SubmitButton } from '@/components/SubmitButton'
export default async function ClientsPage() {
  const { orgId } = await auth()

  if (!orgId) {
    return (
      <main className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='text-slate-600'>
          Select an organisation to manage clients.
        </p>
      </main>
    )
  }

  // Tenant wall (layer 1): only this firm's clients.
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.orgId, orgId))
    .orderBy(desc(clients.createdAt))

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-8'>
        <h1 className='font-serif text-2xl text-slate-900'>Clients</h1>
        <p className='mt-1 text-sm text-slate-500'>
          Onboard a client, then open them to create a case.
        </p>
      </div>

      {/* Onboard-a-client form. `action={createClient}` submits straight to the
          server action — no fetch, no API route, no client JS. */}
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

      {rows.length === 0 ? (
        <div className='rounded-xl border border-dashed border-slate-300 p-10 text-center'>
          <p className='text-slate-500'>
            No clients yet. Add your first above.
          </p>
        </div>
      ) : (
        <ul className='space-y-2'>
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/clients/${c.id}`}
                className='flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50'
              >
                <span className='font-medium text-slate-900'>{c.name}</span>
                <span className='text-xs text-slate-400'>
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
