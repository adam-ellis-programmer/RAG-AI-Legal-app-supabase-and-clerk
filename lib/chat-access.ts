// lib/chat-access.ts
// The shared access rule:

// Who may read a chat conversation. Used by BOTH the Next app (loading history)
// and the chat server (sending), so the rule is written once.
// `db` is passed in rather than imported: each side has its own connection
// (Vercel: short-lived; Railway: a long-lived pool). This file must not import
// anything Next-only, or the chat server can't use it.
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import {
  chatConversations,
  chatMembers,
  chatMessages,
  chatReads,
  matterMembers,
  matters,
} from '@/lib/schema'
import type { db as AppDb } from '@/lib/db'
import type { ChatMessage } from '@/lib/chat-events'

type Db = typeof AppDb
export type ChatConversation = typeof chatConversations.$inferSelect

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A DM's key: the two userIds sorted, so A→B and B→A give the same key. */
export function dmKeyFor(a: string, b: string) {
  return [a, b].sort().join(':')
}

/** Everyone who may read this conversation *right now*. */
export async function conversationRecipients(
  db: Db,
  c: ChatConversation,
): Promise<string[]> {
  if (c.type === 'case') {
    if (!c.matterId) return []
    // The current case team, read live: removing someone from the case
    // removes them from its chat at the same moment.
    const rows = await db
      .select({ userId: matterMembers.userId })
      .from(matterMembers)
      .innerJoin(matters, eq(matters.id, matterMembers.matterId))
      .where(
        and(eq(matterMembers.matterId, c.matterId), eq(matters.orgId, c.orgId)),
      )
    return rows.map((r) => r.userId)
  }

  const rows = await db
    .select({ userId: chatMembers.userId })
    .from(chatMembers)
    .where(eq(chatMembers.conversationId, c.id))
  return rows.map((r) => r.userId)
}

/** The conversation if this user may access it in this firm, otherwise null. */
export async function getAccessibleConversation(
  db: Db,
  userId: string,
  orgId: string,
  conversationId: string,
): Promise<ChatConversation | null> {
  // A junk id from the URL would make Postgres throw on the uuid column,
  // so treat it as "not found" instead.
  if (!UUID.test(conversationId)) return null

  // Layer 1 (firm wall): the conversation must belong to this firm.
  const [c] = await db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.orgId, orgId),
      ),
    )
    .limit(1)
  if (!c) return null

  // Layer 2 (case team / DM membership)
  const people = await conversationRecipients(db, c)
  return people.includes(userId) ? c : null
}

// ---------

/** A database row → what we send to browsers. Removed messages lose their text here. */
// prettier-ignore
export function toChatMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.deletedAt ? '' : row.body,
    removed: row.deletedAt !== null,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Why you can't post in this conversation, or null if you can. Read-only isn't no-access. */
// prettier-ignore
export async function postingBlockedReason(db: Db, c: ChatConversation): Promise<string | null> {
  // Checked with the env var directly: lib/demo imports Next-only code.
  if (process.env.DEMO_ORG_ID && c.orgId === process.env.DEMO_ORG_ID) {
    return 'Chat is read-only in the demo firm.'
  }
  if (c.type === 'case' && c.matterId) {
    const [m] = await db.select({ status: matters.status }).from(matters).where(eq(matters.id, c.matterId)).limit(1)
    if (m && m.status !== 'open') return `This case is ${m.status}, so its chat is read-only.`
  }
  return null
}

/** Every conversation this user is in: their (non-archived) case chats + their DMs. */
export async function myConversationIds(
  db: Db,
  userId: string,
  orgId: string,
): Promise<string[]> {
  const [cases, dms] = await Promise.all([
    db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .innerJoin(
        matters,
        and(
          eq(matters.id, chatConversations.matterId),
          eq(matters.orgId, orgId),
        ),
      )
      .innerJoin(
        matterMembers,
        and(
          eq(matterMembers.matterId, matters.id),
          eq(matterMembers.userId, userId),
        ),
      )
      .where(
        and(eq(chatConversations.orgId, orgId), ne(matters.status, 'archived')),
      ),
    db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .innerJoin(
        chatMembers,
        and(
          eq(chatMembers.conversationId, chatConversations.id),
          eq(chatMembers.userId, userId),
        ),
      )
      .where(
        and(
          eq(chatConversations.orgId, orgId),
          eq(chatConversations.type, 'direct'),
        ),
      ),
  ])
  return [...cases, ...dms].map((r) => r.id)
}

/** Unread messages per conversation: from other people, since you last read it. */
export async function unreadCounts(
  db: Db,
  userId: string,
  conversationIds: string[],
): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {}
  const rows = await db
    .select({
      conversationId: chatMessages.conversationId,
      n: sql<number>`count(*)::int`,
    })
    .from(chatMessages)
    .leftJoin(
      chatReads,
      and(
        eq(chatReads.conversationId, chatMessages.conversationId),
        eq(chatReads.userId, userId),
      ),
    )
    .where(
      and(
        inArray(chatMessages.conversationId, conversationIds),
        ne(chatMessages.senderId, userId), // your own messages are never "unread"
        isNull(chatMessages.deletedAt),
        // Never opened it? Then everything counts: "epoch" means the start of time.
        sql`${chatMessages.createdAt} > coalesce(${chatReads.lastReadAt}, 'epoch'::timestamptz)`,
      ),
    )
    .groupBy(chatMessages.conversationId)
  return Object.fromEntries(rows.map((r) => [r.conversationId, r.n]))
}

/**
 * How unread works: chat_reads stores when you last read each conversation.
 * Unread means messages after that time, from someone else. The left join keeps conversations you’ve never
 * opened (they have no chat_reads row), and coalesce(…, 'epoch')
 * treats them as “never read”, so every message in them counts.
 */

/**
 * Again, one rule, two users: the page uses postingBlockedReason
 * to hide the input box, and the server uses it to refuse the message.
 * The page is just for a friendly display; the server check is the real lock.
 * Someone could always send a message from the browser console, but the server would still refuse it.
 */
