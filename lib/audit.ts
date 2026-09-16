// lib/audit.ts
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/schema'

type LogInput = {
  orgId: string
  userId: string
  action: string // e.g. 'client.created', 'document.view', 'query.ask'
  matterId?: string | null
  userName?: string | null
  targetType?: string | null // e.g. 'client', 'matter', 'document'
  targetId?: string | null
  detail?: string | null
}

/** "First Last", trimmed, falling back to a secondary value (e.g. email). */
export function displayName(
  first?: string | null,
  last?: string | null,
  fallback?: string | null,
) {
  const name = [first, last]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
  return name || fallback?.trim() || null
}

/** Snapshot of the acting user's name — only if it IS the acting user. */
async function resolveActorName(userId: string) {
  try {
    const user = await currentUser()
    if (!user || user.id !== userId) return null
    return displayName(
      user.firstName,
      user.lastName,
      user.primaryEmailAddress?.emailAddress,
    )
  } catch {
    return null
  }
}

/**
 * Append a row to the audit log. Call this at every sensitive server action.
 * Logging must NEVER break the main action, so errors are swallowed (but reported).
 */
export async function logAction(input: LogInput) {
  try {
    const userName =
      input.userName !== undefined
        ? input.userName
        : await resolveActorName(input.userId)

    await db.insert(auditLogs).values({
      orgId: input.orgId,
      userId: input.userId,
      action: input.action,
      matterId: input.matterId ?? null,
      userName,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      detail: input.detail ?? null,
    })
  } catch (err) {
    console.error('audit log failed:', err)
  }
}