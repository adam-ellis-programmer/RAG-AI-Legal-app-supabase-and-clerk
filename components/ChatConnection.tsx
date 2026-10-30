// components/ChatConnection.tsx
'use client'
// ONE chat socket for the whole signed-in app, plus the unread counts that the
// navbar badge, the tab title and the chat list all read. Lives in app/app/layout.tsx.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/lib/chat-events'
import { markConversationRead } from '@/app/app/chat/actions'

// The browser's order: first what we LISTEN to, then what we SEND.
export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

type ChatState = {
  socket: ChatSocket | null
  unread: Record<string, number> // conversationId → unread count
  totalUnread: number
  setOpenConversation: (id: string | null) => void // which chat is on screen right now
  markRead: (id: string) => void
}

const ChatContext = createContext<ChatState>({
  socket: null,
  unread: {},
  totalUnread: 0,
  setOpenConversation: () => {},
  markRead: () => {},
})

export const useChat = () => useContext(ChatContext)

/** Kept so existing code using it still works. */
export const useChatSocket = () => useContext(ChatContext).socket

export function ChatConnection({
  children,
  initialUnread,
  conversationIds,
}: {
  children: ReactNode
  initialUnread: Record<string, number> // counted on the server at page load
  conversationIds: string[] // the chats you're in, as of page load
}) {
  const { isSignedIn, orgId, userId, getToken } = useAuth()
  const router = useRouter()
  const [socket, setSocket] = useState<ChatSocket | null>(null)
  const [unread, setUnread] = useState(initialUnread)

  // A fresh count from the server (a full load or router.refresh) replaces ours.
  useEffect(() => {
    setUnread(initialUnread)
  }, [initialUnread])

  // Values the socket handler needs to read at the moment a message arrives,
  // without the socket reconnecting whenever they change.
  const openRef = useRef<string | null>(null)
  const knownRef = useRef(new Set(conversationIds))
  const userIdRef = useRef(userId)
  const getTokenRef = useRef(getToken)
  useEffect(() => {
    knownRef.current = new Set(conversationIds)
  }, [conversationIds])
  useEffect(() => {
    userIdRef.current = userId
    getTokenRef.current = getToken
  }, [userId, getToken])

  const markRead = useCallback((id: string) => {
    setUnread((prev) => (prev[id] ? { ...prev, [id]: 0 } : prev))
    markConversationRead(id).catch(() => {}) // a failed marker isn't worth an error on screen
  }, [])

  const setOpenConversation = useCallback((id: string | null) => {
    openRef.current = id
  }, [])

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CHAT_URL
    if (!isSignedIn || !orgId || !url) return

    const s: ChatSocket = io(url, {
      // Called on every (re)connect, so the server always gets a fresh token.
      auth: (cb) => {
        getTokenRef.current().then((token) => cb({ token }))
      },
    })

    s.on('connect', () => console.log('[chat] connected', s.id))
    s.on('connect_error', (err) =>
      console.warn('[chat] could not connect:', err.message),
    )

    // Every message for you arrives here, whatever page you're on.
    s.on('message:new', (m: ChatMessage) => {
      if (m.senderId === userIdRef.current) return // your own message

      // A chat you didn't have when the page loaded (e.g. someone just DMed you):
      // ask the server to rebuild the lists so it appears.
      if (!knownRef.current.has(m.conversationId)) {
        knownRef.current.add(m.conversationId)
        router.refresh()
      }

      // You're reading it right now, so ChatThread marks it read instead.
      if (m.conversationId === openRef.current) return

      setUnread((prev) => ({
        ...prev,
        [m.conversationId]: (prev[m.conversationId] ?? 0) + 1,
      }))
    })

    setSocket(s)
    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [isSignedIn, orgId, router])

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0)
  const value = useMemo(
    () => ({ socket, unread, totalUnread, setOpenConversation, markRead }),
    [socket, unread, totalUnread, setOpenConversation, markRead],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

/**
 * What’s new and why:

      * The context now carries more than the socket: the unread counts, plus two functions. The badge, the list and the thread all read the same numbers, so they can never disagree.
      * initialUnread comes from the server, so the badge is right on the very first paint after a refresh. The socket keeps it up to date after that.
      * router.refresh() asks Next to re-run the server components (the layouts with their lists and counts) without a full page reload. The socket stays connected and your typing isn’t lost. That’s what makes a brand-new DM appear in your list live.
      * Refs (openRef, knownRef…): the socket handler is created once. If it read normal state, it would only ever see the values from when it was created (a “stale closure”). A ref is a box whose current contents it can always read.
      * useChatSocket is kept, so nothing else breaks.
 */
