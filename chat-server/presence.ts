// chat-server/presence.ts
// Who's online, per firm, kept in memory. Counts SOCKETS per person, so closing
// one of two tabs doesn't mark someone offline. Fine for one server instance;
// several instances would need to share this (e.g. via Redis).
const online = new Map<string, Map<string, number>>() // orgId → (userId → open sockets)

/** Returns true if this person has just come online (their first socket). */
export function addSocket(orgId: string, userId: string): boolean {
  const firm = online.get(orgId) ?? new Map<string, number>()
  online.set(orgId, firm)
  const count = (firm.get(userId) ?? 0) + 1
  firm.set(userId, count)
  return count === 1
}

/** Returns true if this person has just gone offline (their last socket closed). */
export function removeSocket(orgId: string, userId: string): boolean {
  const firm = online.get(orgId)
  if (!firm) return false
  const count = (firm.get(userId) ?? 0) - 1
  if (count > 0) {
    firm.set(userId, count)
    return false
  }
  firm.delete(userId)
  if (firm.size === 0) online.delete(orgId)
  return true
}

export function onlineIn(orgId: string): string[] {
  return [...(online.get(orgId)?.keys() ?? [])]
}