// components/DemoSignIn.tsx
// Signs the visitor in with the one-time token, makes the demo firm active,
// then takes them to the clients list.
'use client'

import { useEffect, useRef, useState } from 'react'
import { SignOutButton, useClerk, useSignIn, useUser } from '@clerk/nextjs'

export default function DemoSignIn({ token, orgId }: { token: string | null; orgId: string }) {
  const { signIn } = useSignIn()
  const { isLoaded, isSignedIn } = useUser()
  const { setActive } = useClerk()
  const [error, setError] = useState<string | null>(null)
  const [otherAccount, setOtherAccount] = useState(false)
  const started = useRef(false) // React may run effects twice in development

  useEffect(() => {
    if (!isLoaded || !token || started.current) return
    started.current = true

    // Switch to the demo firm, then load the app. This fails if the
    // signed-in user isn't a member of the demo firm (i.e. it's someone else).
    async function openDemoFirm() {
      await setActive({ organization: orgId })
      // A full page load, not router.push, so the server sees the new session.
      window.location.assign('/app/clients')
    }

    ;(async () => {
      // Already signed in: fine if it's the demo account (e.g. a refresh).
      if (isSignedIn) {
        try {
          await openDemoFirm()
        } catch {
          setOtherAccount(true)
        }
        return
      }

      const { error } = await signIn.ticket({ ticket: token })
      if (error || signIn.status !== 'complete') {
        setError('This demo link has expired. Please go back and try again.')
        return
      }
      // Activate the session; we navigate ourselves afterwards.
      await signIn.finalize({ navigate: async () => {} })
      await openDemoFirm()
    })().catch((err) => {
      console.error('Demo sign-in failed:', err) // visible in the browser console
      setError('Something went wrong starting the demo. Please try again.')
    })
  }, [isLoaded, isSignedIn, token, signIn, setActive, orgId])

  if (otherAccount) {
    return (
      <main className='mx-auto max-w-md px-6 py-24 text-center'>
        <p className='text-slate-700'>You&apos;re signed in to another account. Sign out first to try the demo.</p>
        <SignOutButton redirectUrl='/'>
          <button className='mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm'>Sign out</button>
        </SignOutButton>
      </main>
    )
  }

  return (
    <main className='mx-auto max-w-md px-6 py-24 text-center'>
      <p className='text-slate-700'>
        {error ?? (token ? 'Opening the demo firm…' : 'No demo link found.')}
      </p>
      {(error || !token) && (
        <a href='/' className='mt-4 inline-block text-sm underline'>Back to the home page</a>
      )}
    </main>
  )
}