// lib/chat-access.ts
// The shared access rule: 

// Who may read a chat conversation. Used by BOTH the Next app (loading history)
// and the chat server (sending), so the rule is written once.
// `db` is passed in rather than imported: each side has its own connection
// (Vercel: short-lived; Railway: a long-lived pool). This file must not import
// anything Next-only, or the chat server can't use it.
import { and, eq } from 'drizzle-orm'
import type { db as AppDb } from '@/lib/db'
import { chatConversations, chatMembers, chatMessages, matterMembers, matters } from '@/lib/schema'
import type { ChatMessage } from '@/lib/chat-events'

type Db = typeof AppDb
export type ChatConversation = typeof chatConversations.$inferSelect

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A DM's key: the two userIds sorted, so A→B and B→A give the same key. */
export function dmKeyFor(a: string, b: string) {
  return [a, b].sort().join(':')
}

/** Everyone who may read this conversation *right now*. */
export async function conversationRecipients(db: Db, c: ChatConversation): Promise<string[]> {
  if (c.type === 'case') {
    if (!c.matterId) return []
    // The current case team, read live: removing someone from the case
    // removes them from its chat at the same moment.
    const rows = await db
      .select({ userId: matterMembers.userId })
      .from(matterMembers)
      .innerJoin(matters, eq(matters.id, matterMembers.matterId))
      .where(and(eq(matterMembers.matterId, c.matterId), eq(matters.orgId, c.orgId)))
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
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.orgId, orgId)))
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




/**
  * Again, one rule, two users: the page uses postingBlockedReason 
  * to hide the input box, and the server uses it to refuse the message.
  * The page is just for a friendly display; the server check is the real lock. 
  * Someone could always send a message from the browser console, but the server would still refuse it.
 */