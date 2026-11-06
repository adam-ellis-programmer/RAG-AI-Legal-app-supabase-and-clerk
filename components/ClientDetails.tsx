// components/ClientDetails.tsx
// The client's personal details, with an inline edit form.
// Only rendered for people on at least one of this client's cases.

import { ClientDetailsForm } from './ClientDetailsForm'
import { formatDay, type DateFormat } from '@/lib/dates'
import { ClientMap } from './ClientMap'
/** notes **
         <dl>, <dt> and <dd> are HTML's "description list", the right element for label-and-value pairs, and screen readers announce them as such. className='contents' makes each wrapper div disappear from the layout, so labels and values line up in the two-column grid.
        defaultValue pre-fills the form with the current details. Empty fields become null in the action, so clearing a field removes it.
        <details> for editing, like the searchable panel: the form is hidden until wanted, with no JavaScript needed.
 */

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

export function ClientDetails({
  client,
  canEdit,
  fmt,
}: {
  client: Details
  canEdit: boolean
  fmt: DateFormat
}) {
  const address = [
    client.addressLine1,
    client.addressLine2,
    client.town,
    client.postcode,
  ]
    .filter(Boolean)
    .join(', ')
  
  // prettier-ignore
  const rows: [string, string | null][] = [
    ['Date of birth', client.dateOfBirth ? formatDay(client.dateOfBirth, fmt) : null],
    ['Address', address || null],
    ['Phone', client.phone],
    ['Email', client.email],
  ]

  return (
    <section className='mb-8 rounded-xl border border-slate-200 p-4'>
      <h2 className='mb-3 text-sm font-semibold text-slate-700'>
        Client details
      </h2>

      <dl className='grid grid-cols-[8rem_1fr] gap-y-2 text-sm'>
        {rows.map(([label, value]) => (
          <div key={label} className='contents'>
            <dt className='text-slate-500'>{label}</dt>
            <dd className={value ? 'text-slate-900' : 'text-slate-400'}>
              {value ?? 'Not recorded'}
            </dd>
          </div>
        ))}
      </dl>

      {client.latitude != null && client.longitude != null && (
        <ClientMap
          latitude={client.latitude}
          longitude={client.longitude}
          address={address}
        />
      )}

      {canEdit && (
        <details className='mt-4'>
          <summary className='cursor-pointer text-sm text-slate-600 hover:text-slate-900'>
            Edit details
          </summary>
          <ClientDetailsForm client={client} />
        </details>
      )}
    </section>
  )
}
