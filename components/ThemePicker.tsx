// components/ThemePicker.tsx
'use client'
// Light / Dark / System buttons. Saved in this browser by next-themes.
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  // The server can't know the saved choice (it's in the browser), so only show
  // which button is selected once we're running in the browser.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div role='radiogroup' aria-label='Theme' className='inline-flex rounded-md border border-slate-300 p-0.5 text-sm'>
      {OPTIONS.map((o) => {
        const selected = mounted && theme === o.value
        return (
          <button
            key={o.value}
            type='button'
            role='radio'
            aria-checked={selected}
            onClick={() => setTheme(o.value)}
            className={`rounded px-3 py-1.5 ${selected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}