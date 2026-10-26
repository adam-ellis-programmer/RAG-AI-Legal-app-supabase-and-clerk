// components/ViewSwitch.tsx
'use client'
// A Rows / Grid switch for server-rendered lists. The page renders BOTH views;
// this only sets data-view on the wrapper, and Tailwind's group-data-[view=…]
// classes show one and hide the other. No data comes through here.

// This is a reusable version (any list page can use it), unlike CaseLayout, which is specific to cases:
import { useEffect, useState, type ReactNode } from 'react'

export type View = 'list' | 'grid'

export function ViewSwitch({
  storageKey,
  defaultView = 'list',
  children,
}: {
  storageKey: string // a separate memory per page, e.g. 'clients-view'
  defaultView?: View
  children: ReactNode
}) {
  const [view, setView] = useState<View>(defaultView)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'list' || saved === 'grid') setView(saved)
    } catch {}
  }, [storageKey])

  function choose(next: View) {
    setView(next)
    try { localStorage.setItem(storageKey, next) } catch {}
  }

  return (
    <div data-view={view} className='group'>
      <div className='mb-3 flex justify-end'>
        <div role='group' aria-label='View' className='inline-flex rounded-md border border-slate-300 p-0.5 text-xs'>
          {(['list', 'grid'] as const).map((v) => (
            <button
              key={v}
              type='button'
              onClick={() => choose(v)}
              aria-pressed={view === v}
              className={`rounded px-2.5 py-1 ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {v === 'list' ? 'Rows' : 'Grid'}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}