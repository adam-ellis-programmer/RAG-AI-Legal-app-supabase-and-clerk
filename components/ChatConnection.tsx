// components/ChatConnection.tsx
'use client'
// Opens ONE chat socket for the whole signed-in app and shares it through
// context. It lives in app/app/layout.tsx, so it stays connected while you
// move between pages. The navbar badge and the /app/chat page both use it.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/lib/chat-events'

// Note the order for the browser: first what we LISTEN to, then what we SEND.
export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const ChatSocketContext = createContext<ChatSocket | null>(null)

/** The shared chat socket, or null while not connected. */
export function useChatSocket() {
  return useContext(ChatSocketContext)
}

export function ChatConnection({ children }: { children: ReactNode }) {
  const { isSignedIn, orgId, getToken } = useAuth()
  const [socket, setSocket] = useState<ChatSocket | null>(null)

  // Always call the latest getToken without making it a reason to reconnect.
  const getTokenRef = useRef(getToken)
  useEffect(() => {
    getTokenRef.current = getToken
  }, [getToken])

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CHAT_URL
    if (!isSignedIn || !orgId || !url) return

    const s: ChatSocket = io(url, {
      // Called on every (re)connect, so the server always gets a FRESH token
      // (Clerk tokens only last about a minute).
      auth: (cb) => {
        getTokenRef.current().then((token) => cb({ token }))
      },
      transports: ['websocket'], //  ← remove: the default (polling, then upgrade) works on more networks
    })

    s.on('connect', () => console.log('[chat] connected', s.id))
    s.on('connect_error', (err) =>
      console.warn('[chat] could not connect:', err.message),
    )
    setSocket(s)

    // Signing out or switching firm: close this socket (the effect then re-runs
    // and, for a new firm, opens a new one with that firm's token).
    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [isSignedIn, orgId])

  return (
    <ChatSocketContext.Provider value={socket}>
      {children}
    </ChatSocketContext.Provider>
  )
}

/**
         How it works
        * Context (createContext / useChatSocket) means any component inside the layout can ask “give me the socket” without passing it down through props. It’s the same idea Clerk uses for useAuth().
        * useAuth() gives the browser the signed-in user, their active firm (orgId), and getToken(), which returns the short-lived session token our chat server verifies.
        * auth: (cb) => … is a function, not a fixed value, so Socket.IO calls it every time it connects or reconnects. That matters because the token expires in about a minute: after a Wi-Fi drop, the reconnect gets a fresh token instead of replaying a stale one (which the server would reject).
        * [isSignedIn, orgId]: the socket is rebuilt only when you sign in or out, or switch firm. Switching firm reconnects with the new firm’s token, so you land in the right org: room. That’s the tenant wall carried into chat.
        * getTokenRef: holds the latest getToken without putting it in the dependency list. If it were in the list and Clerk ever handed us a new function, the socket would needlessly disconnect and reconnect.
        * transports: ['websocket']: Socket.IO normally starts with HTTP “long-polling” and upgrades to a websocket. Going straight to a websocket is simpler and avoids issues on hosting platforms.
        * The cleanup (return () => s.disconnect()): React runs it when the component unmounts or before the effect re-runs, so you never end up with two sockets.
        * NEXT_PUBLIC_CHAT_URL: readable here because of the NEXT_PUBLIC_ prefix. If it’s missing, we just don’t connect, and the app works as normal without chat.
 */
