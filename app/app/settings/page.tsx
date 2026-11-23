// app/app/settings/page.tsx
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { isDemoOrg } from '@/lib/demo'
import { getChatPreviewLength, getFirmFormat } from '@/lib/firm-settings'
import { FirmSettingsForm } from '@/components/FirmSettingsForm'
import { ThemePicker } from '@/components/ThemePicker'
import { Notice } from '@/components/Notice'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const { orgId, orgRole } = await auth()
  if (!orgId) notFound()

  const [fmt, chatPreviewLength, sp] = await Promise.all([
    getFirmFormat(orgId),
    getChatPreviewLength(orgId),
    searchParams,
  ])
  const canEdit = orgRole === 'org:admin' && !isDemoOrg(orgId)

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <h1 className='font-serif text-2xl text-slate-900'>Firm settings</h1>
      <p className='mt-1 text-sm text-slate-500'>
        Your own preferences, and settings for your whole firm.
      </p>
      {sp.saved === '1' && (
        <Notice tone='success' className='mt-4'>
          Settings saved.
        </Notice>
      )}

      <section className='mt-8 rounded-xl border border-slate-200 p-5'>
        <h2 className='mb-4 text-sm font-semibold text-slate-700'>
          Dates, times and money
        </h2>
        <FirmSettingsForm
          initial={{ ...fmt, chatPreviewLength }}
          canEdit={canEdit}
        />
      </section>

      <section className='mt-8 rounded-xl border border-slate-200 p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>Appearance</h2>
        <p className='mb-4 mt-1 text-xs text-slate-500'>
          Just for you, on this device.
        </p>
        <ThemePicker />
      </section>
    </main>
  )
}
