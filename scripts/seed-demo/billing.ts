// scripts/seed-demo/billing.ts
// Stage 6: invoices on the demo cases, so the billing pages look lived-in.
// There's no status column: paid / part paid / unpaid comes from paidPence vs amountPence,
// so the mix below is chosen to show all three.
import { db } from '@/lib/db'
import { invoices } from '@/lib/schema'
import { ORG_ID, daysAgo } from './config'
import type { People, PersonKey } from './people'
import type { Cases } from './cases'

type InvoiceSpec = {
  case: keyof Cases
  daysAgo: number
  amountPence: number
  paidPence: number
  createdBy: PersonKey
}

// prettier-ignore
const INVOICES: InvoiceSpec[] = [
  // Hartley boundary dispute
  { case: 'boundary',   daysAgo: 40, amountPence: 45000,  paidPence: 45000, createdBy: 'eleanor' }, // paid
  { case: 'boundary',   daysAgo: 20, amountPence: 125000, paidPence: 50000, createdBy: 'eleanor' }, // part paid
  { case: 'boundary',   daysAgo: 5,  amountPence: 68000,  paidPence: 0,     createdBy: 'eleanor' }, // unpaid
  // Brookfield right of way
  { case: 'rightOfWay', daysAgo: 33, amountPence: 90000,  paidPence: 90000, createdBy: 'daniel' },  // paid
  { case: 'rightOfWay', daysAgo: 12, amountPence: 145000, paidPence: 0,     createdBy: 'daniel' },  // unpaid
  // Party wall: behind the ethical wall, so the demo visitor never sees this one
  { case: 'partyWall',  daysAgo: 3,  amountPence: 35000,  paidPence: 0,     createdBy: 'daniel' },
]

/** 'YYYY-MM-DD' for a date column. */
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

export async function seedBilling(people: People, cases: Cases) {
  // Number invoices in the order they were issued, like a real firm would:
  // oldest first → INV-2026-0001, INV-2026-0002, …
  const inOrder = [...INVOICES].sort((a, b) => b.daysAgo - a.daysAgo)

  const rows = inOrder.map((inv, i) => ({
    orgId: ORG_ID,
    matterId: cases[inv.case].id,
    number: `INV-2026-${String(i + 1).padStart(4, '0')}`,
    issuedOn: dateOnly(daysAgo(inv.daysAgo)),
    amountPence: inv.amountPence,
    paidPence: inv.paidPence,
    createdBy: people[inv.createdBy],
    createdAt: daysAgo(inv.daysAgo),
  }))

  await db.insert(invoices).values(rows)
  console.log(
    `  ${rows.length} invoices across ${new Set(rows.map((r) => r.matterId)).size} cases`,
  )
}
