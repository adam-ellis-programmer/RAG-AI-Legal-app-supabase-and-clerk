// components/ThemeProvider.tsx
'use client'
// Light / dark / system theme for the whole app. Adds class="dark" to <html>
// when dark is active, and remembers the choice in this browser.
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute='class'            // dark mode = class="dark" on <html>
      defaultTheme='system'        // until someone chooses, follow their computer
      enableSystem
      disableTransitionOnChange    // switch instantly, without everything fading at different speeds
    >
      {children}
    </NextThemesProvider>
  )
}