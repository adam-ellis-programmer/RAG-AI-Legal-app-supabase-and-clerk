// app/app/settings/page.tsx
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { isDemoOrg } from '@/lib/demo'
import { getFirmFormat } from '@/lib/firm-settings'
import { FirmSettingsForm } from '@/components/FirmSettingsForm'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const { orgId, orgRole } = await auth()
  if (!orgId) notFound()

  const [fmt, sp] = await Promise.all([getFirmFormat(orgId), searchParams])
  const canEdit = orgRole === 'org:admin' && !isDemoOrg(orgId)

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <h1 className='font-serif text-2xl text-slate-900'>Firm settings</h1>
      <p className='mt-1 text-sm text-slate-500'>These apply to everyone in your firm.</p>

      {sp.saved === '1' && (
        <p className='mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200'>
          Settings saved.
        </p>
      )}

      <section className='mt-8 rounded-xl border border-slate-200 p-5'>
        <h2 className='mb-4 text-sm font-semibold text-slate-700'>Dates and times</h2>
        <FirmSettingsForm initial={fmt} canEdit={canEdit} />
      </section>
    </main>
  )
}