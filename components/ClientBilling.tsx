// components/ClientBilling.tsx
// Money across this client's cases, limited to the cases the viewer is admin on.
import Link from 'next/link'
import { formatPence } from '@/lib/money'

type Row = { matterId: string; title: string; charged: number; paid: number }

export function ClientBilling({ rows }: { rows: Row[] }) {
  const charged = rows.reduce((s, r) => s + r.charged, 0)
  const paid = rows.reduce((s, r) => s + r.paid, 0)
  const owed = charged - paid

  return (
    <section className='mb-8 rounded-xl border border-slate-200 p-4'>
      <h2 className='text-sm font-semibold text-slate-700'>Billing</h2>
      <p className='mb-3 text-xs text-slate-500'>
        Totals from the cases you&apos;re an admin on.
      </p>

      <dl className='mb-3 grid grid-cols-3 gap-2 text-sm'>
        {(
          [
            ['Charged', charged],
            ['Paid', paid],
            ['Owed', owed],
          ] as const
        ).map(([label, pence]) => (
          <div key={label} className='rounded-lg border border-slate-200 p-3'>
            <dt className='text-xs text-slate-500'>{label}</dt>
            <dd className={`mt-1 font-medium ${label === 'Owed' && owed > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {formatPence(pence)}
            </dd>
          </div>
        ))}
      </dl>

      <ul className='divide-y divide-slate-100 text-sm'>
        {rows.map((r) => {
          const caseOwed = r.charged - r.paid
          return (
            <li key={r.matterId} className='flex items-center gap-3 py-2'>
              <Link href={`/app/matters/${r.matterId}#billing`} className='min-w-0 flex-1 truncate text-slate-900 hover:underline'>
                {r.title}
              </Link>
              <span className='text-slate-500'>{formatPence(r.charged)}</span>
              {caseOwed > 0 ? (
                <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'>{formatPence(caseOwed)} owed</span>
              ) : (
                <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'>Paid</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}