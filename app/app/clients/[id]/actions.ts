// app/app/clients/[id]/actions.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, matters, matterMembers } from '@/lib/schema'
import { logAction } from '@/lib/audit'
import { assertNotDemo } from '@/lib/demo'

// ---------------------------------------------------------------------------
// Create a case (matter) for a client
// ---------------------------------------------------------------------------

export async function createMatter(formData: FormData) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')

  // ----- Assert Demo ---------
  await assertNotDemo()

  const clientId = String(formData.get('clientId') || '')
  const title = String(formData.get('title') || '').trim()
  const reference = String(formData.get('reference') || '').trim() || null
  if (!clientId || !title) return

  // Security: verify the client actually belongs to THIS firm before using the
  // clientId from the form (never trust a hidden field blindly).
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)))
    .limit(1)
  if (!client) throw new Error('Client not found')

  // 1. Create the case (matter), linked to the client.
  const [matter] = await db
    .insert(matters)
    .values({ orgId, clientId, title, reference, createdBy: userId })
    .returning()

  // 2. Auto-add the creator to the case team as an admin (layer-2 access).
  await db.insert(matterMembers).values({
    matterId: matter.id,
    userId,
    role: 'admin',
  })

  // 3. Audit log — records who created which case.
  await logAction({
    orgId,
    userId,
    matterId: matter.id,
    action: 'matter.created',
    targetType: 'matter',
    targetId: matter.id,
    detail: title,
  })

  revalidatePath(`/app/clients/${clientId}`)
}

// ---------------------------------------------------------------------------
// Update a client's personal details (DOB, address, phone, email)
// ---------------------------------------------------------------------------

// Turn a form field into a trimmed string, or null if it's empty.
function field(formData: FormData, name: string) {
  const v = String(formData.get(name) ?? '').trim()
  return v === '' ? null : v
}

// What the action returns to the form (read by useActionState in ClientDetailsForm).
export type DetailsFormState = {
  error?: string
  saved?: boolean
  values?: Record<string, string> // what they typed, so a mistake doesn't wipe the form
}

const DETAIL_FIELDS = [
  'dateOfBirth',
  'addressLine1',
  'addressLine2',
  'town',
  'postcode',
  'phone',
  'email',
]

export async function updateClientDetails(
  _prev: DetailsFormState, // the previous result; required by useActionState, not used here
  formData: FormData,
): Promise<DetailsFormState> {
  // ---- Who is asking? (unexpected failures THROW → error page) ----
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')

  // ----- Assert Demo ---------
  await assertNotDemo()

  const clientId = String(formData.get('clientId') || '')

  // Layer 1: the client must belong to this firm.
  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)))
    .limit(1)
  if (!client) throw new Error('Client not found')

  // Layer 2: personal data follows case membership. You must be on at
  // least one of this client's cases to see or change their details.
  const [onCase] = await db
    .select({ id: matterMembers.id })
    .from(matterMembers)
    .innerJoin(matters, eq(matters.id, matterMembers.matterId))
    .where(
      and(eq(matters.clientId, clientId), eq(matterMembers.userId, userId)),
    )
    .limit(1)
  if (!onCase) throw new Error('Client not found')

  // ---- Expected mistakes RETURN a message → shown under the form ----
  const values = Object.fromEntries(
    DETAIL_FIELDS.map((k) => [k, String(formData.get(k) ?? '')]),
  )

  // Comparing as strings works: YYYY-MM-DD sorts alphabetically in date order.
  const dateOfBirth = field(formData, 'dateOfBirth')
  if (dateOfBirth && dateOfBirth > new Date().toISOString().slice(0, 10)) {


    return { error: 'Date of birth cannot be in the future.', values }
  }

  const email = field(formData, 'email')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'That email address does not look right.', values }
  }

  // ---- Save ----
  await db
    .update(clients)
    .set({
      dateOfBirth,
      addressLine1: field(formData, 'addressLine1'),
      addressLine2: field(formData, 'addressLine2'),
      town: field(formData, 'town'),
      postcode: field(formData, 'postcode')?.toUpperCase() ?? null,
      phone: field(formData, 'phone'),
      email,
    })
    .where(eq(clients.id, clientId))

  await logAction({
    orgId,
    userId,
    action: 'client.updated',
    targetType: 'client',
    targetId: clientId,
    detail: client.name,
  })

  revalidatePath(`/app/clients/${clientId}`)
  return { saved: true }
}
