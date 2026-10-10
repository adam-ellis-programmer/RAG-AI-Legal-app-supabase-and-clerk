// app/app/layout.tsx
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { OrganizationSwitcher, SignOutButton, UserButton } from '@clerk/nextjs'
import { isDemoOrg } from '@/lib/demo'

// once we are on the app page with uploads etc
// we have a different LAYOUT to all the other
// home pages etc
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgId } = await auth.protect()
  const isDemo = isDemoOrg(orgId)

  return (
    <div className='flex min-h-screen flex-col'>
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
  )
}
