// app/app/error.tsx
// Shown when something throws while rendering a page under /app (or in a server
// action used by one). It replaces the page content but keeps the app's nav,
// because it sits inside app/app/layout.tsx.
'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log it in the browser console too, which helps when debugging.
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className='mx-auto max-w-md px-6 py-24 text-center'>
      <h1 className='font-serif text-2xl text-slate-900'>Something went wrong</h1>
      <p className='mt-2 text-sm text-slate-600'>
        This page couldn&apos;t be loaded. Please try again. If you&apos;re exploring
        the demo firm, note that uploading and editing are switched off.
      </p>

      {/* In development, show the real message. In production Next.js hides it,
          so show the reference code instead, which you can find in the logs. */}
      {process.env.NODE_ENV === 'development' ? (
        <p className='mt-4 rounded-md bg-red-50 p-2 text-xs text-red-700'>{error.message}</p>
      ) : (
        error.digest && <p className='mt-4 text-xs text-slate-400'>Reference: {error.digest}</p>
      )}

      <div className='mt-6 flex justify-center gap-2'>
        <button
          onClick={() => reset()}
          className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
        >
          Try again
        </button>
        <Link
          href='/app/clients'
          className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'
        >
          Back to clients
        </Link>
      </div>
    </main>
  )
}