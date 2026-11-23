// components/FirmSettingsForm.tsx
'use client'
// The firm-wide settings: dates, money and chat notifications. A client component only for the
// live previews as you change the dropdowns; saving goes through the server action.
import { useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { saveFirmSettings } from '@/app/app/settings/actions'
import { formatDateTime, LOCALE_OPTIONS, TIME_ZONE_OPTIONS } from '@/lib/dates'
import { formatPence, CURRENCY_OPTIONS } from '@/lib/money'
import type { FirmFormat } from '@/lib/firm-settings' // type only: no server code reaches the browser
import { PREVIEW_LENGTH_OPTIONS } from '@/lib/chat-events'
// Fixed samples, so the previews are identical on the server and in the browser.
const SAMPLE_DATE = '2026-09-23T09:22:41Z'
const SAMPLE_PENCE = 125050 // 1,250.50
const groups = [...new Set(TIME_ZONE_OPTIONS.map((z) => z.group))]

export function FirmSettingsForm({
  initial,
  canEdit,
}: {
  initial: FirmFormat & { chatPreviewLength: number }
  canEdit: boolean
}) {
  const [locale, setLocale] = useState(initial.locale)
  const [timeZone, setTimeZone] = useState(initial.timeZone)
  const [currency, setCurrency] = useState(initial.currency)

  return (
    <form action={saveFirmSettings} className='space-y-4'>
      <label className='block text-sm'>
        <span className='mb-1 block font-medium text-slate-700'>
          Date format
        </span>
        <select
          name='locale'
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          disabled={!canEdit}
          className='w-full rounded-md border border-slate-300 px-3 py-2'
        >
          {LOCALE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className='block text-sm'>
        <span className='mb-1 block font-medium text-slate-700'>Time zone</span>
        <select
          name='timeZone'
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          disabled={!canEdit}
          className='w-full rounded-md border border-slate-300 px-3 py-2'
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {TIME_ZONE_OPTIONS.filter((z) => z.group === g).map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className='block text-sm'>
        <span className='mb-1 block font-medium text-slate-700'>
          Billing currency
        </span>
        <select
          name='currency'
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          disabled={!canEdit}
          className='w-full rounded-md border border-slate-300 px-3 py-2'
        >
          {CURRENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className='mt-1 block text-xs text-slate-500'>
          For your invoices and billing. Changing it doesn&apos;t convert
          existing amounts.
        </span>
      </label>

      {/* ----------- chat notification options ----------------- */}
       <label className='block text-sm'>
        <span className='mb-1 block font-medium text-slate-700'>Chat notifications</span>
        <select
          name='chatPreviewLength'
          defaultValue={initial.chatPreviewLength}
          disabled={!canEdit}
          className='w-full rounded-md border border-slate-300 px-3 py-2'
        >
          {PREVIEW_LENGTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className='mt-1 block text-xs text-slate-500'>
          How much of a message appears in pop-up notifications. Off keeps message text off
          screens that others might see.
        </span>
      </label>

      <div className='space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200'>
        <p>
          Dates will look like:{' '}
          <strong className='text-slate-900'>
            {formatDateTime(SAMPLE_DATE, { locale, timeZone })}
          </strong>
        </p>
        <p>
          Amounts will look like:{' '}
          <strong className='text-slate-900'>
            {formatPence(SAMPLE_PENCE, { locale, currency })}
          </strong>
        </p>
      </div>

      {canEdit ? (
        <SubmitButton
          pendingText='Saving…'
          className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
        >
          Save
        </SubmitButton>
      ) : (
        <p className='text-sm text-slate-500'>
          Only firm admins can change these.
        </p>
      )}
    </form>
  )
}

/**
 * The live previews recalculate as you change the dropdowns, before saving, so an admin can see exactly what everyone will get.
 * SAMPLE_DATE is fixed, not new Date(), because the server and browser would each read the clock at slightly different moments; if the minute changed in between, React would complain the HTML didn't match.
 * <optgroup> gives the grouped headings ("United States", "Australia & NZ"…) inside the dropdown.
 */
