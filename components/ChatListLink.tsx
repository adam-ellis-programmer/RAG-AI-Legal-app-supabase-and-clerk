// components/ChatListLink.tsx
'use client'
// A conversation in the chat list: highlighted when open, with its unread count.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useChat } from '@/components/ChatConnection'

export function ChatListLink({
  href,
  conversationId,
  children,
}: {
  href: string
  conversationId?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const { unread } = useChat()
  const active = pathname === href
  const count = conversationId && !active ? (unread[conversationId] ?? 0) : 0

  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className={`truncate ${count ? 'font-semibold text-slate-900' : ''}`}>{children}</span>
      {count > 0 && (
        <span className='shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white'>
          {count}
        </span>
      )}
    </Link>
  )
}