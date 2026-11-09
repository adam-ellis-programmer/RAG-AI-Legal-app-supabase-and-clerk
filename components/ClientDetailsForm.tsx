// components/ClientDetailsForm.tsx
// The edit form. A client component so it can show the action's result
// (a validation message, or "Saved") without leaving the page.
// Includes Google's address search: picking a suggestion fills in the address
// fields and the exact map position.
'use client'

import { useActionState, useRef, type FormEvent } from 'react'
import {
  updateClientDetails,
  type DetailsFormState,
} from '@/app/app/clients/[id]/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { AddressAutocomplete, type PickedAddress } from '@/components/AddressAutocomplete'

type Details = {
  id: string
  dateOfBirth: string | null
  addressLine1: string | null
  addressLine2: string | null
  town: string | null
  postcode: string | null
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
}

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

// Typing in any of these by hand means the stored exact position may no longer match.
const ADDRESS_FIELDS = ['addressLine1', 'addressLine2', 'town', 'postcode']

// Only show the search box when Google is set up (the key is in the env).
const hasGoogle = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

export function ClientDetailsForm({ client }: { client: Details }) {
  const [state, formAction] = useActionState<DetailsFormState, FormData>(
    updateClientDetails,
    {},
  )
  const formRef = useRef<HTMLFormElement>(null)

  // After a mistake, show what they typed; otherwise the saved details.
  const v = (key: keyof Details) => state.values?.[key] ?? client[key] ?? ''

  // Put a value into one of this form's inputs, by its name.
  function setField(name: string, value: string) {
    const el = formRef.current?.elements.namedItem(name)
    if (el instanceof HTMLInputElement) el.value = value
  }

  // A suggestion was picked: fill in the address and its exact position.
  function fillFromPick(a: PickedAddress) {
    setField('addressLine1', a.addressLine1)
    setField('addressLine2', a.addressLine2)
    setField('town', a.town)
    setField('postcode', a.postcode)
    setField('latitude', String(a.latitude))
    setField('longitude', String(a.longitude))
  }

  // Typed into an address field by hand? Forget the exact position, so the
  // server falls back to the postcode lookup instead of keeping a stale pin.
  function handleInput(e: FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name
    if (ADDRESS_FIELDS.includes(name)) {
      setField('latitude', '')
      setField('longitude', '')
    }
  }

  return (
    // prettier-ignore
    <form ref={formRef} action={formAction} onInput={handleInput} className='mt-3 grid gap-2 sm:grid-cols-2'>
      <input type='hidden' name='clientId' value={client.id} />
      {/* The exact position: starts as the saved one, set by the search box, cleared by hand edits */}
      <input type='hidden' name='latitude' defaultValue={client.latitude ?? ''} />
      <input type='hidden' name='longitude' defaultValue={client.longitude ?? ''} />

      <label className='text-xs text-slate-500 sm:col-span-2'>
        Date of birth
        <input type='date' name='dateOfBirth' defaultValue={v('dateOfBirth')} className={input} />
      </label>

      {hasGoogle && (
        <div className='sm:col-span-2'>
          <span className='mb-1 block text-xs text-slate-500'>Search for an address</span>
          <AddressAutocomplete onPick={fillFromPick} />
          <span className='mt-1 block text-xs text-slate-400'>Or type it in below.</span>
        </div>
      )}

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
