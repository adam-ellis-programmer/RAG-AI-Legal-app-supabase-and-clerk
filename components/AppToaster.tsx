// components/AppToaster.tsx
'use client'
// Where toasts appear. A client wrapper so Sonner can follow the app's light/dark theme.
import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'

export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position='bottom-right'
      closeButton
    />
  )
}

/** It needs 'use client' because useTheme is a hook, and hooks only run in client components.
 * The layout is a server component, so it can't use them directly. */
