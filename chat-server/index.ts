// chat-server/index.ts
// Citewise firm chat: a long-running Socket.IO server (Railway in production).
// Step 2: accept connections only with a valid Clerk session token, and
// put each socket in its user's room and its firm's room.
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { verifyToken } from '@clerk/backend'

const PORT = Number(process.env.PORT ?? 4000) // Railway sets PORT; 4000 locally
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
if (!CLIENT_ORIGIN || !CLERK_SECRET_KEY) {
  throw new Error(
    'Missing env: CLIENT_ORIGIN and CLERK_SECRET_KEY are required',
  )
}

// The events each side can send. Filled in when we add messages (step 5).
interface ClientToServerEvents {}
interface ServerToClientEvents {}
interface InterServerEvents {}
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
  console.log(`[chat] connected ${userId} (firm ${orgId}) socket ${socket.id}`)

  socket.on('disconnect', (reason) => {
    console.log(`[chat] disconnected ${userId}: ${reason}`)
  })
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
