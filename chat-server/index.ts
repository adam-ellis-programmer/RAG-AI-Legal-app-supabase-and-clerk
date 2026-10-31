// chat-server/index.ts
// Citewise firm chat: a long-running Socket.IO server (Railway in production).
// Step 2: accept connections only with a valid Clerk session token, and
// put each socket in its user's room and its firm's room.
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { verifyToken } from '@clerk/backend'

import { db } from '@/lib/db'
import { chatMessages } from '@/lib/schema'
import {
  conversationRecipients,
  getAccessibleConversation,
  postingBlockedReason,
  toChatMessage,
} from '@/lib/chat-access'

import {
  MAX_MESSAGE_LENGTH,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@/lib/chat-events'

import { addSocket, onlineIn, removeSocket } from './presence'

interface InterServerEvents {}
interface SocketData {
  userId: string
  orgId: string
}

const PORT = Number(process.env.PORT ?? 4000) // Railway sets PORT; 4000 locally
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
if (!CLIENT_ORIGIN || !CLERK_SECRET_KEY) {
  throw new Error(
    'Missing env: CLIENT_ORIGIN and CLERK_SECRET_KEY are required',
  )
}

// The events each side can send. Filled in when we add messages (step 5).

// What we know about each connected socket, set once at sign-in.
interface SocketData {
  userId: string
  orgId: string
}

// A plain HTTP server underneath. /health lets Railway check it's alive.
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200).end('ok')
    return
  }
  res.writeHead(404).end()
})

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, { cors: { origin: CLIENT_ORIGIN } })

// Runs BEFORE a connection is accepted: the socket version of `await auth()`.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token
    if (typeof token !== 'string') return next(new Error('unauthorised'))

    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties: [CLIENT_ORIGIN], // only tokens issued to OUR site
    })

    // The active firm. Newer Clerk tokens put it at o.id, older ones at org_id.
    const claims = payload as {
      sub: string
      o?: { id?: string }
      org_id?: string
    }
    const orgId = claims.o?.id ?? claims.org_id
    if (!orgId) return next(new Error('no organisation selected'))

    socket.data = { userId: claims.sub, orgId }
    next()
  } catch {
    next(new Error('unauthorised')) // expired, forged, or for another site
  }
})

io.on('connection', (socket) => {
  const { userId, orgId } = socket.data

  // Rooms are people (plus a firm room for "who's online"), not conversations:
  // each message is sent to the current members' user rooms.
  socket.join(`user:${userId}`)
  socket.join(`org:${orgId}`)

  // Presence: tell the firm if you've just come online; otherwise just tell this
  // new socket who's around.
  // prettier-ignore
  if (addSocket(orgId, userId)) io.to(`org:${orgId}`).emit('presence', onlineIn(orgId))
  else socket.emit('presence', onlineIn(orgId))

  console.log(`[chat] connected ${userId} (firm ${orgId}) socket ${socket.id}`)

  // ===== ADDED IN AFTER START =========================================================================================
  // A simple rate limit per connection: at most 10 messages per 10 seconds.
  const recent: number[] = []
  function withinRateLimit() {
    const now = Date.now()
    while (recent.length && now - recent[0] > 10_000) recent.shift()
    if (recent.length >= 10) return false
    recent.push(now)
    return true
  }

  socket.on('message:send', async (input, ack) => {
    if (typeof ack !== 'function') return // every send must ask for a reply
    try {
      const body = typeof input?.body === 'string' ? input.body.trim() : ''
      if (!body) return ack({ ok: false, error: 'Message is empty.' })
      if (body.length > MAX_MESSAGE_LENGTH) {
        return ack({
          ok: false,
          error: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`,
        })
      }
      if (!withinRateLimit())
        return ack({ ok: false, error: 'Slow down a little and try again.' })

      // Who you are comes from the verified token (socket.data), never from the message.
      const conversation = await getAccessibleConversation(
        db,
        userId,
        orgId,
        String(input.conversationId),
      )
      if (!conversation)
        return ack({ ok: false, error: 'Conversation not found.' })

      const blocked = await postingBlockedReason(db, conversation)
      if (blocked) return ack({ ok: false, error: blocked })

      // Save first: the database is the record. Then tell people.
      const [row] = await db
        .insert(chatMessages)
        .values({
          orgId,
          conversationId: conversation.id,
          senderId: userId,
          body,
        })
        .returning()
      const message = toChatMessage(row)

      // Recipients worked out NOW, so a removal from the case takes effect at once.
      const recipients = await conversationRecipients(db, conversation)
      io.to(recipients.map((id) => `user:${id}`)).emit('message:new', message)

      ack({ ok: true, message })
    } catch (err) {
      console.error('[chat] send failed', err)
      ack({ ok: false, error: 'Could not send. Please try again.' })
    }
  })
  // ===== ADDED IN AFTER END =========================================================================================

  // prettier-ignore
  socket.on('disconnect', (reason) => {
    console.log(`[chat] disconnected ${userId}: ${reason}`)
    if (removeSocket(orgId, userId)) io.to(`org:${orgId}`).emit('presence', onlineIn(orgId))
  })

  // added in when we built the connection dots:
  //  Why only on changes: opening a third tab doesn’t change who’s online, so there’s no point messaging the whole firm. The new tab just gets the current list for itself.
})

httpServer.listen(PORT, () => console.log(`[chat] listening on :${PORT}`))

/**
      What each part does
        * io.use(...) is middleware: it runs before a connection is accepted, so a socket that fails it never connects at all. It’s the chat server’s version of your pages calling await auth() and the webhook checking its signature.
        * verifyToken: the browser will send its Clerk session token (a short-lived signed JWT). Using your CLERK_SECRET_KEY, Clerk’s library checks that it’s genuine and not expired, then tells us who it belongs to: sub is the userId. Nobody can fake one without your secret key.
        * authorizedParties: Clerk tokens record which website they were issued for. This rejects a valid token that was taken from some other site.
        * The org claim: Clerk has changed where the active organisation sits in the token over time, so we check both places. If it’s missing (the user hasn’t selected a firm), we refuse, because every chat is firm-scoped.
        * socket.data: set once, by the server, from the verified token. Later, when a message arrives, we use socket.data.userId, never a userId sent by the browser, which could be faked. It’s the same rule as server actions reading auth() rather than trusting form fields.
        * cors: { origin }: browsers only let pages from CLIENT_ORIGIN (your app) open a connection.
        * The empty event interfaces: these will become the list of allowed events (message:send, message:new…), and TypeScript will then check both sides use the same names and shapes.
        * One thing to know: Clerk tokens only last about a minute, but we only check them when connecting. An open socket stays open after that. That’s normal for websockets, and every message will still be checked against the database (getAccessibleConversation). When the socket reconnects, the browser fetches a fresh token.
 */

/**
  Why import @/lib/db directly: your scripts (comp-org, the seed) already use it under tsx, which proves it has nothing Next-only in it. Locally it uses your normal DATABASE_URL. On Railway, we’ll set DATABASE_URL to the session pooler URL, so the same code gets the right connection.
*/

/**
 What each check is for:

       *  typeof ack, typeof input?.body, String(…): anything from the browser is untrusted. TypeScript types don’t exist at runtime, so a hand-crafted message could contain anything. We check the shape ourselves.
       *  userId / orgId from socket.data: these were set from the verified Clerk token. The message itself can’t claim to be from someone else.
       *  getAccessibleConversation runs on every message, not just at connect time, so access is always checked against the current database.
       *  Save, then broadcast: if the insert fails, nobody sees a message that doesn’t exist.
       *  io.to([...rooms]): sends to several rooms at once, and a person with two tabs gets it in both.
       *  ack: the reply to the sender, either ok with the saved message, or a friendly error to show.
 */
