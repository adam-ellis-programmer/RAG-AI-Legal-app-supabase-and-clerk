// components/ChatBadge.tsx
'use client'
// The red unread count beside "Chat", and "(3) Citewise" in the browser tab.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@/components/ChatConnection'

export function ChatBadge() {
  const { totalUnread } = useChat()
  const pathname = usePathname()

  // Re-applied after each page change too, because Next resets the title when you navigate.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '')
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? '99+' : totalUnread}) ${base}` : base
  }, [totalUnread, pathname])

  if (totalUnread === 0) return null
  return (
    <span
      className='ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white'
      aria-label={`${totalUnread} unread messages`}
    >
      {totalUnread > 99 ? '99+' : totalUnread}
    </span>
  )
}