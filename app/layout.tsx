// app/layout.tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google'
import './globals.css'

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang='en'
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
    >
      <body className='bg-white text-slate-900'>
        <ClerkProvider>
          {children} {/* ← page.tsx renders HERE */}
        </ClerkProvider>
      </body>
    </html>
  )
}
