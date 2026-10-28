// components/ChatListLink.tsx
'use client'
// A conversation in the left-hand list. Client-side only to know which one is
// open (usePathname); the list itself is rendered on the server.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function ChatListLink({ href, activeHref, children }: { href: string; activeHref?: string; children: ReactNode }) {
  const pathname = usePathname()
  const active = pathname === (activeHref ?? href)
  return (
    <Link
      href={href}
      prefetch={false}
      className={`block truncate rounded-md px-3 py-2 text-sm ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
    >
      {children}
    </Link>
  )
}