// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className='mx-auto max-w-3xl px-6 py-24 text-center'>
      <h1 className='font-serif text-2xl text-slate-900'>Not found</h1>
      <p className='mt-2 text-sm text-slate-500'>
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href='/app'
        className='mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
      >
        Back to the app
      </Link>
    </main>
  )
}