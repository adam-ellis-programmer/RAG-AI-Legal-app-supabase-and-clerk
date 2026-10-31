// lib/chat-events.ts
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
}

export interface ServerToClientEvents {
  'message:new': (message: ChatMessage) => void
  presence: (onlineUserIds: string[]) => void // everyone in your firm who's in the app right now
}
