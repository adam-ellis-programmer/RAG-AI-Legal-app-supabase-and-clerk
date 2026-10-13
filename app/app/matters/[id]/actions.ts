// app/app/matters/[id]/actions.ts
'use server'

import { currentUser } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, matters, matterMembers, invoices } from '@/lib/schema'
import { formatPence, parsePounds } from '@/lib/money'
import { logAction } from '@/lib/audit'
import { getMatterAccess, getOrgMembers, isUuid } from '@/lib/matter-access'
import { assertNotDemo } from '@/lib/demo'

const ROLES = ['admin', 'member'] as const
type Role = (typeof ROLES)[number] // () -> first get the type of ROLES, then index into it. TypeScript

// ----- require admin for matters  ----------
// Both walls + the acting user must be an ADMIN on this case.
async function requireMatterAdmin(matterId: string) {
  const access = await getMatterAccess(matterId)
  if (!access) throw new Error('Case not found')
  if (access.membership.role !== 'admin') {
    throw new Error('Only case admins can manage the team')
  }
  return access
}

// Snapshot of the acting user's name for the audit log.
async function actorName() {
  const user = await currentUser()
  if (!user) return null
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.primaryEmailAddress?.emailAddress ||
    null
  )
}

// ----- add matter member ----------

export async function addMatterMember(formData: FormData) {
  const matterId = String(formData.get('matterId') || '')
  const targetUserId = String(formData.get('userId') || '')
  const roleInput = String(formData.get('role') || 'member')
  if (!matterId || !targetUserId) return

  // ----- Assert Demo ---------
  await assertNotDemo()
  if (!ROLES.includes(roleInput as Role)) throw new Error('Invalid role')
  const role = roleInput as Role

  const { userId, orgId } = await requireMatterAdmin(matterId)

  // Never trust the userId from the form: confirm with Clerk that this
  // person is actually in THIS firm before giving them access to the case.
  const orgMembers = await getOrgMembers(orgId)
  const target = orgMembers.find((m) => m.userId === targetUserId)
  if (!target) throw new Error('That user is not a member of this firm')

  // Already on the team? Nothing to do. (The unique index is the backstop.)
  const [existing] = await db
    .select({ id: matterMembers.id })
    .from(matterMembers)
    .where(
      and(
        eq(matterMembers.matterId, matterId),
        eq(matterMembers.userId, targetUserId),
      ),
    )
    .limit(1)
  if (existing) return

  await db
    .insert(matterMembers)
    .values({ matterId, userId: targetUserId, role })

  await logAction({
    orgId,
    userId,
    userName: await actorName(),
    matterId,
    action: 'member.added',
    targetType: 'member',
    targetId: targetUserId,
    detail: `${target.name} (${role})`,
  })

  revalidatePath(`/app/matters/${matterId}`)
}

// ----- remove member ----------

export async function removeMatterMember(formData: FormData) {
  const matterId = String(formData.get('matterId') || '')
  const memberId = String(formData.get('memberId') || '')
  if (!matterId || !memberId || !isUuid(memberId)) return

  // ----- Assert Demo ---------
  await assertNotDemo()

  const { userId, orgId, matter } = await requireMatterAdmin(matterId)
  // The membership row must belong to THIS case (not just any id from the form).
  const [target] = await db
    .select()
    .from(matterMembers)
    .where(
      and(eq(matterMembers.id, memberId), eq(matterMembers.matterId, matterId)),
    )
    .limit(1)
  if (!target) throw new Error('Member not found on this case')

  // A case must never end up with no admin — nobody could manage it.
  if (target.role === 'admin') {
    const admins = await db
      .select({ id: matterMembers.id })
      .from(matterMembers)
      .where(
        and(
          eq(matterMembers.matterId, matterId),
          eq(matterMembers.role, 'admin'),
        ),
      )
    if (admins.length <= 1)
      throw new Error('A case must keep at least one admin')
  }

  await db.delete(matterMembers).where(eq(matterMembers.id, target.id))

  const orgMembers = await getOrgMembers(orgId)
  const targetName =
    orgMembers.find((m) => m.userId === target.userId)?.name ?? target.userId

  await logAction({
    orgId,
    userId,
    userName: await actorName(),
    matterId,
    action: 'member.removed',
    targetType: 'member',
    targetId: target.userId,
    detail: `${targetName} (${target.role})`,
  })

  // If you removed yourself, you've just lost access — the case page would 404.
  if (target.userId === userId) redirect(`/app/clients/${matter.clientId}`)

  revalidatePath(`/app/matters/${matterId}`)
}

// ----- change member role ----------

export async function changeMemberRole(formData: FormData) {
  const matterId = String(formData.get('matterId') || '')
  const memberId = String(formData.get('memberId') || '')
  const roleInput = String(formData.get('role') || '')
  if (!matterId || !memberId || !isUuid(memberId)) return
  if (!ROLES.includes(roleInput as Role)) throw new Error('Invalid role')
  const role = roleInput as Role

  // ----- Assert Demo ---------
  await assertNotDemo()

  // Both walls, and the person making the change must be a case admin.
  const { userId, orgId } = await requireMatterAdmin(matterId)

  // The membership row must belong to THIS case.
  const [target] = await db
    .select()
    .from(matterMembers)
    .where(
      and(eq(matterMembers.id, memberId), eq(matterMembers.matterId, matterId)),
    )
    .limit(1)
  if (!target) throw new Error('Member not found on this case')
  if (target.role === role) return // nothing to change

  // Demoting an admin: the case must still have one afterwards.
  if (target.role === 'admin') {
    const admins = await db
      .select({ id: matterMembers.id })
      .from(matterMembers)
      .where(
        and(
          eq(matterMembers.matterId, matterId),
          eq(matterMembers.role, 'admin'),
        ),
      )
    if (admins.length <= 1)
      throw new Error('A case must keep at least one admin')
  }

  // Update in place: no gap in the person's access.
  await db
    .update(matterMembers)
    .set({ role })
    .where(eq(matterMembers.id, target.id))

  const orgMembers = await getOrgMembers(orgId)
  const name =
    orgMembers.find((m) => m.userId === target.userId)?.name ?? target.userId

  await logAction({
    orgId,
    userId,
    matterId,
    action: 'member.role_changed',
    targetType: 'member',
    targetId: target.userId,
    detail: `${name} (${target.role} → ${role})`,
  })

  revalidatePath(`/app/matters/${matterId}`)
}

// ----- change status ----------

const STATUSES = ['open', 'closed', 'archived'] as const
type Status = (typeof STATUSES)[number]

export async function setMatterStatus(formData: FormData) {
  const matterId = String(formData.get('matterId') || '')
  const statusInput = String(formData.get('status') || '')
  if (!STATUSES.includes(statusInput as Status))
    throw new Error('Invalid status')
  const status = statusInput as Status

  // ----- Assert Demo ---------
  await assertNotDemo()

  // Both walls, and only a case admin can open, close or archive.
  const { userId, orgId, matter } = await requireMatterAdmin(matterId)
  if (matter.status === status) return

  await db.update(matters).set({ status }).where(eq(matters.id, matter.id))

  await logAction({
    orgId,
    userId,
    matterId,
    action: 'matter.status_changed',
    targetType: 'matter',
    targetId: matterId,
    detail: `${matter.status} → ${status}`,
  })

  revalidatePath(`/app/matters/${matterId}`)
  revalidatePath(`/app/clients/${matter.clientId}`)
}

// ----- billing: add an invoice ----------

export type InvoiceFormState = {
  error?: string
  saved?: boolean
  values?: Record<string, string>
}

const INVOICE_FIELDS = ['number', 'issuedOn', 'amount', 'paid']

export async function addInvoice(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  // ----- Assert Demo ---------
  await assertNotDemo()

  // Both walls + case admin: billing is for the case lead only (throws if not).
  const matterId = String(formData.get('matterId') || '')

  // requireMatterAdmin does both walls and the admin check in one call
  const { userId, orgId } = await requireMatterAdmin(matterId)

  // Expected mistakes: return them, keeping what was typed.
  const values = Object.fromEntries(
    INVOICE_FIELDS.map((k) => [k, String(formData.get(k) ?? '').trim()]),
  )
  const today = new Date().toISOString().slice(0, 10)

  if (!values.number) {
    return { error: 'Give the invoice a number, e.g. INV-2026-0042.', values }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.issuedOn)) {
    return { error: 'Choose the date the invoice was issued.', values }
  }
  if (values.issuedOn > today) {
    return { error: 'The issue date cannot be in the future.', values }
  }
  const amountPence = parsePounds(values.amount)
  // if (!amountPence) catches both null (not a number) and 0 (a zero invoice), since both are falsy.
  if (!amountPence) {
    return { error: 'Enter the invoice amount, e.g. 1250 or 1,250.50.', values }
  }
  const paidPence = values.paid === '' ? 0 : parsePounds(values.paid)
  if (paidPence === null) {
    return {
      error: 'Enter the amount paid so far, e.g. 500, or leave it blank.',
      values,
    }
  }
  if (paidPence > amountPence) {
    return { error: 'The amount paid cannot be more than the invoice.', values }
  }

  const [invoice] = await db
    .insert(invoices)
    .values({
      orgId,
      matterId,
      number: values.number,
      issuedOn: values.issuedOn,
      amountPence,
      paidPence,
      createdBy: userId,
    })
    .returning({ id: invoices.id })

  await logAction({
    orgId,
    userId,
    matterId,
    action: 'invoice.added',
    targetType: 'invoice',
    targetId: invoice.id,
    detail: `${values.number} · ${formatPence(amountPence)}`,
  })

  revalidatePath(`/app/matters/${matterId}`)
  return { saved: true }
}

// ----- billing: mark an invoice as paid in full ----------


// markInvoicePaid checks access against the invoice’s own case. 
// The form only sends an invoice ID, so we look up which case it belongs to, 
// then check you’re an admin there. 
// Trusting a matterId sent from the form would let someone mark another case’s invoice as paid.

// Owed is never stored. Marking an invoice paid just sets paid = amount, and “owed” (amount − paid) becomes zero automatically.
export async function markInvoicePaid(formData: FormData) {
  // ----- Assert Demo ---------
  await assertNotDemo()

  const invoiceId = String(formData.get('invoiceId') || '')
  if (!isUuid(invoiceId)) return

  // Find the invoice first, so we know which case to check access against.
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)
  if (!invoice) throw new Error('Invoice not found')

  // Both walls + case admin, on the invoice's own case.
  const { userId, orgId } = await requireMatterAdmin(invoice.matterId)
  if (invoice.orgId !== orgId) throw new Error('Invoice not found')
  if (invoice.paidPence === invoice.amountPence) return // already paid

  await db
    .update(invoices)
    .set({ paidPence: invoice.amountPence })
    .where(eq(invoices.id, invoice.id))

  await logAction({
    orgId,
    userId,
    matterId: invoice.matterId,
    action: 'invoice.paid',
    targetType: 'invoice',
    targetId: invoice.id,
    detail: `${invoice.number} · ${formatPence(invoice.amountPence)}`,
  })

  revalidatePath(`/app/matters/${invoice.matterId}`)
}
