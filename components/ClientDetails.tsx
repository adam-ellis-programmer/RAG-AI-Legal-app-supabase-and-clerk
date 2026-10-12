// components/ClientDetails.tsx
// The client's personal details, with an inline edit form.
// Only rendered for people on at least one of this client's cases.
import { updateClientDetails } from '@/app/app/clients/[id]/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { ClientDetailsForm } from './ClientDetailsForm'

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
}

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

function formatDob(dob: string | null) {
  if (!dob) return null
  // 'YYYY-MM-DD' is read as UTC midnight, so format it in UTC too,
  // otherwise a timezone shift could show the day before.
  return new Date(dob).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function ClientDetails({
  client,
  canEdit,
}: {
  client: Details
  canEdit: boolean
}) {
  const address = [
    client.addressLine1,
    client.addressLine2,
    client.town,
    client.postcode,
  ]
    .filter(Boolean)
    .join(', ')
  const rows: [string, string | null][] = [
    ['Date of birth', formatDob(client.dateOfBirth)],
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
