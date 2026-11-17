// components/Notice.tsx
// A full-width message box ("Settings saved.", warnings, errors). Same colours as Badge.
import { TONES, type Tone } from './Badge'

export function Notice({
  tone,
  className = '',
  children,
}: {
  tone: Tone
  className?: string // for spacing, e.g. 'mt-4', which differs per page
  children: React.ReactNode
}) {
  return (
    <p className={`rounded-lg p-3 text-sm ring-1 ${TONES[tone]} ${className}`}>
      {children}
    </p>
  )
}
