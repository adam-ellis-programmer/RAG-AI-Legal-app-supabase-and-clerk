// app/app/chat/actions.ts
'use server'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatConversations, chatMembers, chatReads } from '@/lib/schema'
import { dmKeyFor, getAccessibleConversation } from '@/lib/chat-access'
import { getOrgMembers } from '@/lib/matter-access'
import { isDemoOrg } from '@/lib/demo'
import { revalidatePath } from 'next/cache'

// Open the direct message with someone in your firm, creating it the first time.
export async function startDirectMessage(formData: FormData) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error('Not signed in')
  if (isDemoOrg(orgId))
    throw new Error('Direct messages are switched off in the demo firm')

  const otherId = String(formData.get('userId') ?? '')
  if (!otherId || otherId === userId)
    throw new Error('Choose someone else to message')

  // Firm wall: you can only message people in THIS firm.
  const members = await getOrgMembers(orgId)
  if (!members.some((m) => m.userId === otherId))
    throw new Error('That person is not in your firm')

  const dmKey = dmKeyFor(userId, otherId)

  // One transaction: the conversation and both members are created together, or not at all.
  const conversationId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chatConversations)
      .values({ orgId, type: 'direct', dmKey })
      .onConflictDoNothing({
        target: [chatConversations.orgId, chatConversations.dmKey],
      })
      .returning({ id: chatConversations.id })

    if (created) {
      await tx.insert(chatMembers).values([
        { conversationId: created.id, userId },
        { conversationId: created.id, userId: otherId },
      ])
      return created.id
    }

    // Already exists (you've messaged them before, or they messaged you): reuse it.
    const [existing] = await tx
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.orgId, orgId),
          eq(chatConversations.dmKey, dmKey),
        ),
      )
      .limit(1)
    return existing.id
  })

  //   'layout' means “rebuild the layout and everything under it”, so the left-hand list is refreshed too.
  revalidatePath('/app/chat', 'layout') // the list must now include this DM
  redirect(`/app/chat/${conversationId}`)
}



// "I've read this conversation up to now." Called when you open one, and as messages arrive while it's open.
export async function markConversationRead(conversationId: string) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return
  // Only for conversations you can see: no read markers on other people's chats.
  const c = await getAccessibleConversation(db, userId, orgId, conversationId)
  if (!c) return
  const now = new Date()
  await db
    .insert(chatReads)
    .values({ conversationId: c.id, userId, lastReadAt: now })
    .onConflictDoUpdate({ target: [chatReads.conversationId, chatReads.userId], set: { lastReadAt: now } })
    // It’s an upsert, like syncSubscription: the first time it creates the row, and after that it updates the time.
}

/**
 Never trust the form’s userId blindly. We check that the person is in your firm via getOrgMembers. Without that, someone could edit the form in DevTools and open a DM with a user in another firm.
onConflictDoNothing on (orgId, dmKey): if a DM between you two already exists, the insert does nothing and returns no row, and we fetch the existing one instead. So “Message Priya” always lands in the same conversation, whichever of you clicks first.
The transaction: the conversation row and both member rows are written together. If one insert failed halfway, we’d otherwise be left with a conversation that has no members, which nobody could ever open.
redirect comes after the transaction, not inside a try/catch (as with your Stripe actions), because redirect works by throwing a special signal.
 */
