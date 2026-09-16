// app/app/clients/[id]/actions.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, matters, matterMembers } from '@/lib/schema'
import { logAction } from '@/lib/audit'

export async function createMatter(formData: FormData) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')

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