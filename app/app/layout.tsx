// app/app/layout.tsx
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await auth.protect()

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='sticky top-0 z-50 border-b border-slate-200 bg-white'>
        <div className='mx-auto flex h-16 max-w-5xl items-center justify-between px-6'>
          <Link
            href='/'
            className='font-serif text-lg font-semibold text-slate-900'
          >
            Lexo<span className='text-slate-400'>.</span>
          </Link>
          <div className='flex items-center gap-4'>
            <OrganizationSwitcher hidePersonal />
            <UserButton />
          </div>
        </div>
      </header>
      {children} {/* ← page.tsx renders HERE */}
    </div>
  )
}
