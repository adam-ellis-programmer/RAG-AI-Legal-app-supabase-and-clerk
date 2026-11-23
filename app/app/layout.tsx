// app/app/layout.tsx
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { OrganizationSwitcher, SignOutButton, UserButton } from '@clerk/nextjs'
import { isDemoOrg } from '@/lib/demo'
import { ChatConnection } from '@/components/ChatConnection'

import { db } from '@/lib/db'
import { myConversationIds, unreadCounts } from '@/lib/chat-access'
import { ChatBadge } from '@/components/ChatBadge'

import { getOrgMembers } from '@/lib/matter-access'
import { getChatPreviewLength } from '@/lib/firm-settings'
import { AppToaster } from '@/components/AppToaster'

// once we are on the app page with uploads etc
// we have a different LAYOUT to all the other
// home pages etc
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgId, userId } = await auth.protect()
  const isDemo = isDemoOrg(orgId)

  // Your chats and unread counts (badge + live updates), plus what toasts need:
  // colleagues' names and the firm's preview setting. Fetched together, not one after another.

  /** Promise.all runs the three lookups at the same time, so the layout waits for the slowest 
   * one, not all three in a row. getOrgMembers is cache()d, so pages that also 
   * call it during the same request don't hit Clerk twice. */
  const [conversationIds, members, previewLength] = orgId
    ? await Promise.all([
        myConversationIds(db, userId, orgId),
        getOrgMembers(orgId),
        getChatPreviewLength(orgId),
      ])
    : [[], [], 0]
    
  const initialUnread = await unreadCounts(db, userId, conversationIds)
  const names = Object.fromEntries(members.map((m) => [m.userId, m.name]))

  return (
    <ChatConnection
      initialUnread={initialUnread}
      conversationIds={conversationIds}
      names={names}
      previewLength={previewLength}
    >
      {/* border-white: an invisible border (same colour as the background). It stops
    Chrome treating empty areas as "plain colour" and drawing them in a slightly
    different shade in dark mode. Don't remove: see commit message. */}
      <div className='flex min-h-screen flex-col border border-white bg-white'>
        <header className='sticky top-0 z-50 border-b border-slate-200 bg-white'>
          <div className='mx-auto flex h-16 max-w-5xl items-center justify-between px-6'>
            <div className='flex items-center gap-6'>
              <Link
                href='/'
                className='font-serif text-lg font-semibold text-slate-900'
              >
                Citewise<span className='text-slate-400'>.</span>
              </Link>
              <nav className='flex items-center gap-4 text-sm'>
                <Link
                  href='/app/clients'
                  className='text-slate-600 transition hover:text-slate-900'
                >
                  Clients
                </Link>
                <Link
                  href='/app'
                  className='text-slate-600 transition hover:text-slate-900'
                >
                  Assistant
                </Link>
                <Link
                  href='/app/documents'
                  className='text-slate-600 transition hover:text-slate-900'
                >
                  Documents
                </Link>

                <Link
                  href='/app/chat'
                  className='flex items-center text-slate-600 transition hover:text-slate-900'
                >
                  Chat
                  <ChatBadge />
                </Link>

                <Link
                  className='text-slate-600 transition hover:text-slate-900'
                  href='/app/plan'
                >
                  Plan
                </Link>

                <Link
                  href='/app/settings'
                  className='text-slate-600 transition hover:text-slate-900'
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className='flex items-center gap-4'>
              {isDemo ? (
                // Shared demo account: no firm switcher and no account menu.
                <>
                  <span className='text-sm text-slate-500'>Demo firm</span>
                  <SignOutButton redirectUrl='/'>
                    <button className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50'>
                      Leave demo
                    </button>
                  </SignOutButton>
                </>
              ) : (
                <>
                  <OrganizationSwitcher hidePersonal />
                  <UserButton />
                </>
              )}
            </div>
          </div>
        </header>
        {children}
      </div>
      <AppToaster />
    </ChatConnection>
  )
}
