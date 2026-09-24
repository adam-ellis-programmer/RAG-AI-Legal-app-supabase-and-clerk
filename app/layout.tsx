// app/layout.tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google'
import './globals.css'

import { auth } from '@clerk/nextjs/server'
import { isDemoOrg } from '@/lib/demo'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
// Serif display face for the legal / trustworthy feel. Falls back to a system
// serif if you skip the globals.css step below.
const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Lexo - Answers you can trace to the source',
  description:
    'AI document assistant for legal teams. Grounded, cited answers from your own documents.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // inside the layout component, before the return:
  const { orgId } = await auth()
  const isDemo = isDemoOrg(orgId)



  return (
    <html
      lang='en'
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
    >
      <body className='bg-white text-slate-900'>
        <ClerkProvider>
          {isDemo && (
            <div className='border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-sm text-amber-900'>
              You&apos;re exploring a demo firm with fictional clients. Browsing
              and asking questions work; uploading and editing are switched off.
            </div>
          )}
          {children} {/* ← page.tsx renders HERE */}
        </ClerkProvider>
      </body>
    </html>
  )
}
