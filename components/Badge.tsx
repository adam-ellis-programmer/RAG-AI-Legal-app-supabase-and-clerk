// components/Badge.tsx
// One place for the coloured styles, in light and dark. Used by Badge and Notice.
// prettier-ignore
export const TONES = {
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
  danger:  'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-800',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200', // slate flips by itself, no dark: needed
  accent:  'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
} as const

export type Tone = keyof typeof TONES

// prettier-ignore
export function Badge({
  tone,
  className = '',
  children,
}: {
  tone: Tone
  className?: string // for layout tweaks like 'shrink-0'; colours stay the Badge's job
  children: React.ReactNode
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
