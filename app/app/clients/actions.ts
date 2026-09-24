// app/app/clients/actions.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { clients } from '@/lib/schema'
import { logAction } from '@/lib/audit'
import { assertNotDemo } from '@/lib/demo'

// Server Action is just the function plus action={createClient} on the form.
// A Server Action: runs on the server, called directly from a <form>.
export async function createClient(formData: FormData) {
  const { userId, orgId } = await auth() // verifies who you are server-side
  if (!userId || !orgId) throw new Error('Not authorized')

  //  ----- demo user check ----------
  // Every server action that changes something gets one line at the top, after its existing auth check
  await assertNotDemo()

  const name = String(formData.get('name') || '').trim()
  if (!name) return // ignore empty submissions

  // Insert and get the new row back (so we have its id to log).
  const [created] = await db
    .insert(clients)
    .values({ orgId, name, createdBy: userId })
    .returning()

  // AUDIT LOG — our first one. Records who onboarded which client.
  await logAction({
    orgId,
    userId,
    action: 'client.created',
    targetType: 'client',
    targetId: created.id,
    detail: name,
  })

  // Tell Next.js the clients list changed so the page re-renders with the new row.
  revalidatePath('/app/clients')
}
