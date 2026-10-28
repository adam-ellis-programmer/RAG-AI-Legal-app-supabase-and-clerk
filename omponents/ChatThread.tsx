// components/ChatThread.tsx
'use client'
// One conversation's messages. History arrives from the server (props);
// new messages arrive live over the shared socket.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useChatSocket } from '@/components/ChatConnection'
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '@/lib/chat-events'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/London', // the same on the server and in the browser, so no hydration mismatch
})

export function ChatThread({
  conversationId,
  initialMessages,
  currentUserId,
  names,
  blockedReason,
}: {
  conversationId: string
  initialMessages: ChatMessage[]
  currentUserId: string
  names: Record<string, string>
  blockedReason: string | null
}) {
  const socket = useChatSocket()
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Add a message unless we already have it (the sender gets it twice: the ack AND the broadcast).
  function addMessage(m: ChatMessage) {
    setMessages((prev) =>
      prev.some((p) => p.id === m.id) ? prev : [...prev, m],
    )
  }

  // Listen for new messages in THIS conversation.
  useEffect(() => {
    if (!socket) return
    const onNew = (m: ChatMessage) => {
      if (m.conversationId === conversationId) addMessage(m)
    }
    socket.on('message:new', onNew)
    return () => {
      socket.off('message:new', onNew) // stop listening when you leave this conversation
    }
  }, [socket, conversationId])

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  function send(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !socket || sending) return
    setSending(true)
    setError(null)

    // timeout: if the server never replies (offline, server down), say so after 10s.
    socket
      .timeout(10_000)
      .emit('message:send', { conversationId, body }, (err, res) => {
        setSending(false)
        if (err)
          return setError(
            'No reply from the chat server. Check your connection.',
          )
        if (!res.ok) return setError(res.error)
        setDraft('')
        addMessage(res.message)
      })
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div ref={listRef} className='h-[55vh] space-y-3 overflow-y-auto p-4'>
        {messages.length === 0 && (
          <p className='text-center text-sm text-slate-400'>
            No messages yet. Say hello.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
            >
              <span className='mb-0.5 text-xs text-slate-400'>
                {mine ? 'You' : (names[m.senderId] ?? 'Former firm member')} ·{' '}
                {timeFormat.format(new Date(m.createdAt))}
              </span>
              <p
                className={`max-w-[75%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${
                  m.removed
                    ? 'italic text-slate-400 ring-1 ring-slate-200'
                    : mine
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-900'
                }`}
              >
                {m.removed ? 'Message removed' : m.body}
              </p>
            </div>
          )
        })}
      </div>

      {blockedReason ? (
        <p className='border-t border-slate-200 p-3 text-center text-sm text-slate-500'>
          {blockedReason}
        </p>
      ) : (
        <form onSubmit={send} className='border-t border-slate-200 p-3'>
          {error && <p className='mb-2 text-sm text-red-600'>{error}</p>}
          <div className='flex gap-2'>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter makes a new line.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={socket ? 'Write a message…' : 'Connecting to chat…'}
              className='min-w-0 flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
            />
            <button
              type='submit'
              disabled={!socket || sending || !draft.trim()}
              className='self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40'
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/**
 The important ideas:

        * useState(initialMessages): it starts with the history the server loaded, then grows as live messages arrive.
        * socket.on / socket.off in an effect: start listening when the thread opens and stop when you switch conversations. Without off, every conversation you visited would keep adding listeners, and messages would start appearing twice.
        * Dedupe by id: you’re one of the recipients, so your own message comes back twice (the ack and the broadcast). Whichever arrives first adds it, and the second is ignored.
        * socket.timeout(10_000).emit: without it, if the server never answers, the button would say “Sending…” forever.
        * timeZone: 'Europe/London': this component renders on the server first (in UTC on Vercel), then in the browser (in the user’s time). If the formatted times differed, React would warn that the HTML doesn’t match. Fixing the zone makes both sides identical.
        * whitespace-pre-wrap + plain {m.body}: line breaks show, and React escapes the text, so someone typing <script> sees those characters and nothing runs.
 */
