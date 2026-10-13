// components/CaseBilling.tsx
// The case's invoices and totals. Only rendered for case admins.
import { formatPence } from '@/lib/money'
import { markInvoicePaid } from '@/app/app/matters/[id]/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { InvoiceForm } from '@/components/InvoiceForm'

type Invoice = {
  id: string
  number: string
  issuedOn: string
  amountPence: number
  paidPence: number
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function CaseBilling({
  matterId,
  invoices,
  canEdit,
}: {
  matterId: string
  invoices: Invoice[]
  canEdit: boolean
}) {
  // reduce adds the invoices up: it starts at 0 and adds each invoice’s amount in turn. 
  // Because every amount is whole pence, the totals are exact.
  const charged = invoices.reduce((sum, i) => sum + i.amountPence, 0)
  const paid = invoices.reduce((sum, i) => sum + i.paidPence, 0)
  const owed = charged - paid

  return (
    <section id='billing' className='mt-8 border'>
      <h2 className='mb-1 text-sm font-semibold text-slate-700'>Billing</h2>
      <p className='mb-3 text-xs text-slate-500'>
        Visible to case admins only.
      </p>

      <dl className='mb-3 grid grid-cols-3 gap-2 text-sm'>
        {[
          ['Charged', charged],
          ['Paid', paid],
          ['Owed', owed],
        ].map(([label, pence]) => (
          <div key={label} className='rounded-lg border border-slate-200 p-3'>
            <dt className='text-xs text-slate-500'>{label}</dt>
            <dd
              className={`mt-1 font-medium ${label === 'Owed' && owed > 0 ? 'text-amber-700' : 'text-slate-900'}`}
            >
              {formatPence(pence as number)}
            </dd>
          </div>
        ))}
      </dl>

      {invoices.length === 0 ? (
        <p className='text-sm text-slate-500'>No invoices on this case yet.</p>
      ) : (
        <ul className='divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm'>
          {invoices.map((inv) => {
            const outstanding = inv.amountPence - inv.paidPence
            return (
              <li key={inv.id} className='flex items-center gap-3 px-3 py-2'>
                <span className='min-w-0 flex-1'>
                  <span className='font-medium text-slate-900'>
                    {inv.number}
                  </span>
                  <span className='ml-2 text-xs text-slate-400'>
                    {formatDate(inv.issuedOn)}
                  </span>
                </span>
                <span className='text-slate-900'>
                  {formatPence(inv.amountPence)}
                </span>
                {outstanding === 0 ? (
                  <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'>
                    Paid
                  </span>
                ) : (
                  <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'>
                    {formatPence(outstanding)} owed
                  </span>
                )}
                {canEdit && outstanding > 0 && (
                  <form action={markInvoicePaid}>
                    <input type='hidden' name='invoiceId' value={inv.id} />
                    <SubmitButton
                      pendingText='Saving…'
                      className='rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100'
                    >
                      Mark paid
                    </SubmitButton>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && (
        <details className='mt-3'>
          <summary className='cursor-pointer text-sm text-slate-600 hover:text-slate-900'>
            Add an invoice
          </summary>
          <InvoiceForm matterId={matterId} />
        </details>
      )}
    </section>
  )
}
