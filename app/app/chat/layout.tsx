// app/app/chat/layout.tsx
// The chat page's frame: your conversations on the left, the open one on the right.
// The list is built on the server and only ever contains chats you're allowed in.
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { and, asc, eq, ne } from 'drizzle-orm'
import type { ReactNode } from 'react'
import { db } from '@/lib/db'
import {
  chatConversations,
  chatMembers,
  matterMembers,
  matters,
} from '@/lib/schema'
import { getOrgMembers } from '@/lib/matter-access'
import { ChatListLink } from '@/components/ChatListLink'

export default async function ChatLayout({
  children,
}: {
  children: ReactNode
}) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) notFound()

  const [myCases, myDms, orgMembers] = await Promise.all([
    // Case chats: every (non-archived) case you're on, with its chat if one exists yet.
    db
      .select({
        matterId: matters.id,
        title: matters.title,
        conversationId: chatConversations.id,
      })
      .from(matterMembers)
      .innerJoin(
        matters,
        and(eq(matters.id, matterMembers.matterId), eq(matters.orgId, orgId)),
      )
      .leftJoin(chatConversations, eq(chatConversations.matterId, matters.id))
      .where(
        and(eq(matterMembers.userId, userId), ne(matters.status, 'archived')),
      )
      .orderBy(asc(matters.title)),

    // Direct messages you're in, in this firm.
    db
      .select({
        conversationId: chatConversations.id,
        dmKey: chatConversations.dmKey,
      })
      .from(chatMembers)
      .innerJoin(
        chatConversations,
        and(
          eq(chatConversations.id, chatMembers.conversationId),
          eq(chatConversations.orgId, orgId),
          eq(chatConversations.type, 'direct'),
        ),
      )
      .where(eq(chatMembers.userId, userId)),

    getOrgMembers(orgId),
  ])

  const nameOf = new Map(orgMembers.map((m) => [m.userId, m.name]))

  return (
    <main className='mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[280px_1fr]'>
      <aside className='space-y-6'>
        <h1 className='font-serif text-2xl text-slate-900'>Chat</h1>

        <section>
          <h2 className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Case chats
          </h2>
          {myCases.length === 0 ? (
            <p className='text-sm text-slate-400'>
              You&apos;re not on any cases yet.
            </p>
          ) : (
            <ul className='space-y-0.5'>
              {myCases.map((c) => (
                <li key={c.matterId}>
                  <ChatListLink
                    // Straight to the chat if it exists; otherwise create it first.
                    href={
                      c.conversationId
                        ? `/app/chat/${c.conversationId}`
                        : `/app/chat/case/${c.matterId}`
                    }
                  >
                    {c.title}
                  </ChatListLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Direct messages
          </h2>
          {myDms.length === 0 ? (
            <p className='text-sm text-slate-400'>No direct messages yet.</p>
          ) : (
            <ul className='space-y-0.5'>
              {myDms.map((d) => {
                const otherId = d.dmKey?.split(':').find((id) => id !== userId)
                return (
                  <li key={d.conversationId}>
                    <ChatListLink href={`/app/chat/${d.conversationId}`}>
                      {(otherId && nameOf.get(otherId)) ?? 'Former firm member'}
                    </ChatListLink>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </aside>

      <div className='min-w-0'>{children}</div>
    </main>
  )
}

/**
    * How the case-chat query works: start from your rows in matterMembers (so only cases you’re on, which is the ethical wall), join the matters (in this firm, the tenant wall), then left-join the chat. A case whose chat hasn’t been created yet still appears, with conversationId: null. The link then goes to the “create it” route instead of a conversation.
 
    * DM names: dmKey is "user_a:user_b", so the other person is whichever ID isn’t yours, and getOrgMembers turns that into a name.
 */
