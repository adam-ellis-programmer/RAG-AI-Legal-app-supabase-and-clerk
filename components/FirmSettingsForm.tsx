// components/FirmSettingsForm.tsx
'use client'
// The date settings form. A client component only for the live preview as you
// change the dropdowns; saving goes through the server action.
import { useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { saveFirmSettings } from '@/app/app/settings/actions'
import {
  formatDateTime,
  LOCALE_OPTIONS,
  TIME_ZONE_OPTIONS,
  type DateFormat,
} from '@/lib/dates'

// A fixed moment, so the preview is identical on the server and in the browser.
const SAMPLE = '2026-09-23T09:22:41Z'
const groups = [...new Set(TIME_ZONE_OPTIONS.map((z) => z.group))]

export function FirmSettingsForm({
  initial,
  canEdit,
}: {
  initial: DateFormat
  canEdit: boolean
}) {
  const [locale, setLocale] = useState(initial.locale)
  const [timeZone, setTimeZone] = useState(initial.timeZone)

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

      <p className='rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200'>
        Dates will look like:{' '}
        <strong className='text-slate-900'>
          {formatDateTime(SAMPLE, { locale, timeZone })}
        </strong>
      </p>

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
 * The live preview recalculates as you change the dropdowns, before saving, so an admin can see exactly what everyone will get.
 * SAMPLE is a fixed date, not new Date(), because the server and browser would each read the clock at slightly different moments. If the minute changed in between, React would complain the HTML didn’t match.
 * <optgroup> gives the grouped headings (“United States”, “Australia & NZ”…) inside the dropdown.
 */
