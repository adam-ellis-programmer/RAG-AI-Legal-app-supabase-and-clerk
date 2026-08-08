// components/Navbar.tsx
import Link from 'next/link'
import { Show, UserButton } from '@clerk/nextjs'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight text-slate-900">
          Lexo<span className="text-slate-400">.</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="text-slate-600 transition hover:text-slate-900">
            Pricing
          </Link>

          <Show when="signed-out">
            <Link href="/sign-in" className="text-slate-600 transition hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
            >
              Start free
            </Link>
          </Show>

          <Show when="signed-in">
            <Link href="/app" className="text-slate-600 transition hover:text-slate-900">
              Open app
            </Link>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  )
}