// app/app/chat/case/[matterId]/page.tsx
// "Open this case's chat": makes sure the chat exists, then goes to it.
// Case chats are created the first time anyone opens them.
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatConversations } from '@/lib/schema'
import { getMatterAccess } from '@/lib/matter-access'

export default async function OpenCaseChat({
  params,
}: {
  params: Promise<{ matterId: string }>
}) {
  const { matterId } = await params

  // The same firm wall + case team check as the case page.
  const access = await getMatterAccess(matterId)
  if (!access) notFound()

  // Create it if it doesn't exist. matterId is unique, so this is safe to run
  // any number of times: a second visit (or two people at once) does nothing.
  await db
    .insert(chatConversations)
    .values({ orgId: access.orgId, type: 'case', matterId })
    .onConflictDoNothing({ target: chatConversations.matterId })

  const [c] = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(eq(chatConversations.matterId, matterId))
    .limit(1)

  redirect(`/app/chat/${c.id}`)
}

/**
 * Normally a page shouldn’t write to the database
 * just because someone visited it. This one is an
 * exception because the write is idempotent: it only ensures a row exists,
 * so visiting it twice, or two people at once, gives the same result.
 * (prefetch={false} on the list links also stops Next from visiting
 * it in the background on hover.)
 */
