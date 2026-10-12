// app/global-error.tsx
// Last resort: shown only if the root layout itself fails. It replaces the
// whole page, so it brings its own <html> and <body>, and it can't rely on
// the app's layout or styles being available.
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang='en'>
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '96px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
        <p style={{ color: '#475569' }}>
          Sorry, the page couldn&apos;t be loaded. Please try again in a moment.
        </p>
        {error.digest && (
          <p style={{ color: '#94a3b8', fontSize: 12 }}>Reference: {error.digest}</p>
        )}
        <button onClick={() => reset()} style={{ marginTop: 16, padding: '8px 16px' }}>
          Try again
        </button>
      </body>
    </html>
  )
}