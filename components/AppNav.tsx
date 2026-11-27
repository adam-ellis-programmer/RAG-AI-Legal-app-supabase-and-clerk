// components/AppNav.tsx
'use client'
// The app's main navigation. Large screens: links in the header (DesktopNav).
// Smaller screens: a menu button that opens the same links as a panel (MobileMenu).
// Both read the one LINKS list, so they can never disagree.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { OrganizationSwitcher, SignOutButton } from '@clerk/nextjs'
import { ChatBadge } from '@/components/ChatBadge'
import { useChat } from '@/components/ChatConnection'

type NavLink = {
  href: string
  label: string
  exact?: boolean // only active on this exact URL (for /app, which every page starts with)
  also?: string[] // other sections that belong under this link
  chat?: boolean // shows the unread badge
}

const LINKS: NavLink[] = [
  { href: '/app/clients', label: 'Clients', also: ['/app/matters'] }, // cases live under their clients
  { href: '/app', label: 'Assistant', exact: true },
  { href: '/app/documents', label: 'Documents' },
  { href: '/app/chat', label: 'Chat', chat: true },
  { href: '/app/plan', label: 'Plan' },
  { href: '/app/settings', label: 'Settings' },
]

/** Is this link the section you're in? /app/clients/123 counts as Clients. */
function isActive(pathname: string, link: NavLink) {
  if (link.exact) return pathname === link.href
  return [link.href, ...(link.also ?? [])].some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

/** Large screens: the links in a row. Hidden below lg. */
export function DesktopNav() {
  const pathname = usePathname()
  return (
    <nav aria-label='Main' className='hidden items-center gap-4 text-sm lg:flex'>
      {LINKS.map((link) => {
        const active = isActive(pathname, link)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center transition hover:text-slate-900 ${active ? 'font-medium text-slate-900' : 'text-slate-600'}`}
          >
            {link.label}
            {link.chat && <ChatBadge />}
          </Link>
        )
      })}
    </nav>
  )
}

/** Smaller screens: a menu button and a drop-down panel. Hidden from lg up. */
export function MobileMenu({ isDemo }: { isDemo: boolean }) {
  const pathname = usePathname()
  const { totalUnread } = useChat()
  const [open, setOpen] = useState(false)

  // Escape closes the menu, like any pop-up. The listener only exists while it's open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className='lg:hidden'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls='mobile-menu'
        aria-label={open ? 'Close menu' : 'Open menu'}
        className='relative rounded-md p-2 text-slate-700 hover:bg-slate-100'
      >
        {open ? (
          // ✕
          <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
            <path d='M6 6l12 12M18 6L6 18' />
          </svg>
        ) : (
          // ☰
          <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
            <path d='M4 7h16M4 12h16M4 17h16' />
          </svg>
        )}
        {/* Unread chat messages: a dot on the closed menu, so they're not hidden away */}
        {!open && totalUnread > 0 && (
          <span className='absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500' aria-hidden='true' />
        )}
      </button>

      {open && (
        <div
          id='mobile-menu'
          className='absolute inset-x-0 top-full border-b border-slate-200 bg-white px-6 pb-4 pt-2 shadow-sm'
        >
          <nav aria-label='Main' className='flex flex-col'>
            {LINKS.map((link) => {
              const active = isActive(pathname, link)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)} // close once you've chosen
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-md px-2 py-3 text-sm hover:bg-slate-50 ${active ? 'font-medium text-slate-900' : 'text-slate-600'}`}
                >
                  {link.label}
                  {link.chat && <ChatBadge />}
                </Link>
              )
            })}
          </nav>

          {/* What the header can't fit on a small screen */}
          <div className='mt-2 border-t border-slate-200 pt-3'>
            {isDemo ? (
              <SignOutButton redirectUrl='/'>
                <button className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'>
                  Leave demo
                </button>
              </SignOutButton>
            ) : (
              <OrganizationSwitcher hidePersonal />
            )}
          </div>
        </div>
      )}
    </div>
  )
}