// lib/chat-events.ts
// This file is shared by the browser and the chat server, and it has no database import

// What the browser and the chat server send each other. BOTH sides import this,
// so renaming an event or changing its shape is a type error on both sides.
export const MAX_MESSAGE_LENGTH = 4000

// ----- CONTRACTS ----- //
export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  body: string // '' when removed: a removed message's text never leaves the server
  removed: boolean
  createdAt: string // an ISO string: Date objects don't survive the trip over the socket
}

// prettier-ignore
export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: string }

export interface ClientToServerEvents {
  'message:send': (
    input: { conversationId: string; body: string },
    ack: (res: SendResult) => void,
  ) => void
}

export interface ServerToClientEvents {
  'message:new': (message: ChatMessage) => void
  presence: (onlineUserIds: string[]) => void // everyone in your firm who's in the app right now
}

/** The firm's choice for chat toasts. 0 = name only. Values are characters. */
export const PREVIEW_LENGTH_OPTIONS = [
  { value: 0, label: 'Off: show only who sent it' },
  { value: 40, label: 'Short (40 characters)' },
  { value: 80, label: 'Medium (80 characters)' },
  { value: 140, label: 'Long (140 characters)' },
] as const

/** "A long message…" cut to `max` characters, at a word boundary where possible. */
export function previewText(body: string, max: number) {
  const text = body.replace(/\s+/g, ' ').trim() // line breaks and double spaces → one space
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'

  /** lastSpace > max * 0.6: it cuts at the last whole word, unless that would
   * throw away more than 40% of the allowed length (one very long word, for example),
   * in which case it cuts mid-word. */
}
