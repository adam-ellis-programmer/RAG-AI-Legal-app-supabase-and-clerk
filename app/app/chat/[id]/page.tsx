// app/app/chat/[id]/page.tsx
// One conversation: access-checked on the server, history loaded on the server,
// then ChatThread keeps it live.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatMessages, matters } from '@/lib/schema'
import {
  conversationRecipients,
  getAccessibleConversation,
  postingBlockedReason,
  toChatMessage,
} from '@/lib/chat-access'
import { getOrgMembers } from '@/lib/matter-access'
import { ChatThread } from '@/components/ChatThread'
import { OnlineDot } from '@/components/OnlineDot'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId, orgId } = await auth()
  if (!userId || !orgId) notFound()

  // Firm wall + case team / DM membership.
  const conversation = await getAccessibleConversation(db, userId, orgId, id)
  if (!conversation) notFound()

  const [rows, members, blockedReason, matter, people] = await Promise.all([
    // The latest 50, newest first (uses the conversation+createdAt index)…
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversation.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(50),
    getOrgMembers(orgId),
    postingBlockedReason(db, conversation),
    conversation.matterId
      ? db
          .select({ title: matters.title })
          .from(matters)
          .where(eq(matters.id, conversation.matterId))
          .limit(1)
      : Promise.resolve([]),

    conversationRecipients(db, conversation), // the case team, or the two of you
  ])

  // …then flipped so the oldest is at the top, like any chat.
  const initialMessages = rows.reverse().map(toChatMessage)
  const names = Object.fromEntries(members.map((m) => [m.userId, m.name]))

  const otherId = conversation.dmKey?.split(':').find((u) => u !== userId)
  const title =
    conversation.type === 'case'
      ? (matter[0]?.title ?? 'Case chat')
      : ((otherId && names[otherId]) ?? 'Former firm member')

  return (
    <div className='grid gap-6 lg:grid-cols-[1fr_260px]'>
      <section className='flex flex-col rounded-xl border border-slate-200'>
        <header className='border-b border-slate-200 px-4 py-3'>
          <h2 className='font-medium text-slate-900'>{title}</h2>
        </header>
        <ChatThread
          key={conversation.id} // a fresh thread state per conversation
          conversationId={conversation.id}
          initialMessages={initialMessages}
          currentUserId={userId}
          names={names}
          blockedReason={blockedReason}
        />
      </section>

      <aside className='rounded-xl border border-slate-200 p-4 text-sm'>
        <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
          {conversation.type === 'case' ? 'Case team' : 'In this conversation'}
        </h3>
        <ul className='space-y-1.5'>
          {people.map((id) => (
            <li key={id} className='flex items-center gap-2'>
              <OnlineDot userId={id} />
              <span className='truncate text-slate-700'>
                {id === userId ? 'You' : (names[id] ?? 'Former firm member')}
              </span>
            </li>
          ))}
        </ul>
        {conversation.matterId && (
          <Link
            href={`/app/matters/${conversation.matterId}`}
            className='mt-4 inline-block text-slate-700 underline'
          >
            Open case →
          </Link>
        )}
      </aside>
    </div>
  )
}

/**
 * key={conversation.id}: this tells React that a different
 * conversation is a different ChatThread. Without it, switching
 * from Hartley to Brookfield would reuse the old component and keep
 * Hartley’s messages and draft in its state.
 */
