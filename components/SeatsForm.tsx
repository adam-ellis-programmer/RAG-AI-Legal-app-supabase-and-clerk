'use client'
// Change the number of seats, with a live price preview.
// Prices come in as props: this file must not import lib/plan.ts, because that
// imports the database, which can't be bundled into the browser.
import { useActionState, useState } from 'react'
import { changeSeats, type SeatsFormState } from '@/app/app/plan/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { formatPence } from '@/lib/money'

export function SeatsForm({
  currentSeats,
  minSeats,
  includedSeats,
  flatFeePence,
  extraSeatPence,
}: {
  currentSeats: number
  minSeats: number
  includedSeats: number
  flatFeePence: number
  extraSeatPence: number
}) {
  const [state, formAction] = useActionState<SeatsFormState, FormData>(changeSeats, {})
  const [seats, setSeats] = useState(currentSeats)

  const monthly = (n: number) => flatFeePence + Math.max(0, n - includedSeats) * extraSeatPence
  const diff = monthly(seats) - monthly(currentSeats)

  return (
    <form action={formAction} className='mt-3 space-y-2'>
      <label className='block text-slate-600'>
        Seats
        <input
          type='number'
          name='seats'
          min={minSeats}
          max={200}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          className='ml-2 w-20 rounded-md border border-slate-300 px-2 py-1'
        />
      </label>

      <p className='text-slate-600'>
        New monthly price: <strong>{formatPence(monthly(seats))}</strong>
        {diff > 0 && <> ({formatPence(diff)} more). The rest of this month is charged today.</>}
        {diff < 0 && <> ({formatPence(-diff)} less). Unused time is credited to your next bill.</>}
      </p>

      {state.error && <p role='alert' className='text-red-600'>{state.error}</p>}
      {state.saved && <p className='text-emerald-700'>Seats updated.</p>}

      <SubmitButton
        pendingText='Updating…'
        className='rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800'
      >
        Update seats
      </SubmitButton>
    </form>
  )
}