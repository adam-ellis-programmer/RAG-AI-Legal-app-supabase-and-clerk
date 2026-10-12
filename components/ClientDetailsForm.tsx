// components/ClientDetailsForm.tsx
// The edit form. A client component so it can show the action's result
// (a validation message, or "Saved") without leaving the page.
'use client'

import { useActionState } from 'react'
import { updateClientDetails, type DetailsFormState } from '@/app/app/clients/[id]/actions'
import { SubmitButton } from '@/components/SubmitButton'

type Details = {
  id: string
  dateOfBirth: string | null
  addressLine1: string | null
  addressLine2: string | null
  town: string | null
  postcode: string | null
  phone: string | null
  email: string | null
}

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

export function ClientDetailsForm({ client }: { client: Details }) {
  const [state, formAction] = useActionState<DetailsFormState, FormData>(updateClientDetails, {})

  // After a mistake, show what they typed; otherwise the saved details.
  const v = (key: keyof Details) => state.values?.[key] ?? client[key] ?? ''

  return (
    <form action={formAction} className='mt-3 grid gap-2 sm:grid-cols-2'>
      <input type='hidden' name='clientId' value={client.id} />
      <label className='text-xs text-slate-500 sm:col-span-2'>
        Date of birth
        <input type='date' name='dateOfBirth' defaultValue={v('dateOfBirth')} className={input} />
      </label>
      
      <input name='addressLine1' placeholder='Address line 1' defaultValue={v('addressLine1')} className={input} />
      <input name='addressLine2' placeholder='Address line 2' defaultValue={v('addressLine2')} className={input} />
      <input name='town' placeholder='Town' defaultValue={v('town')} className={input} />
      <input name='postcode' placeholder='Postcode' defaultValue={v('postcode')} className={input} />
      <input name='phone' type='tel' placeholder='Phone' defaultValue={v('phone')} className={input} />
      <input name='email' type='email' placeholder='Email' defaultValue={v('email')} className={input} />


      {state.error && (
        <p role='alert' className='text-sm text-red-600 sm:col-span-2'>{state.error}</p>
      )}
      {state.saved && <p className='text-sm text-emerald-700 sm:col-span-2'>Details saved.</p>}

      <SubmitButton
        pendingText='Saving…'
        className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:col-span-2 sm:justify-self-start'
      >
        Save details
      </SubmitButton>
    </form>
  )
}