// components/InvoiceForm.tsx
// Add-an-invoice form for case admins. Client component so it can show the
// action's result (a validation message, or "Invoice added") in place.
'use client'

import { useActionState } from 'react'
import {
  addInvoice,
  type InvoiceFormState,
} from '@/app/app/matters/[id]/actions'
import { SubmitButton } from '@/components/SubmitButton'

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

export function InvoiceForm({ matterId }: { matterId: string }) {
  const [state, formAction] = useActionState<InvoiceFormState, FormData>(
    addInvoice,
    {},
  )
  const v = (key: string) => state.values?.[key] ?? ''

  // inputMode='decimal' shows a number keypad on phones while still allowing “1,250.50” to be typed. A type='number' box would reject the comma.
  return (
    <form action={formAction} className='mt-3 grid gap-2 sm:grid-cols-2'>
      <input type='hidden' name='matterId' value={matterId} />
      <input
        name='number'
        placeholder='Invoice number'
        defaultValue={v('number')}
        className={input}
      />
      <input
        name='issuedOn'
        type='date'
        defaultValue={v('issuedOn')}
        className={input}
      />
      <input
        name='amount'
        inputMode='decimal'
        placeholder='Amount (£)'
        defaultValue={v('amount')}
        className={input}
      />
      <input
        name='paid'
        inputMode='decimal'
        placeholder='Paid so far (£, optional)'
        defaultValue={v('paid')}
        className={input}
      />

      {state.error && (
        <p role='alert' className='text-sm text-red-600 sm:col-span-2'>
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className='text-sm text-emerald-700 sm:col-span-2'>Invoice added.</p>
      )}

      <SubmitButton
        pendingText='Adding…'
        className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-2 sm:justify-self-start'
      >
        Add invoice
      </SubmitButton>
    </form>
  )
}
