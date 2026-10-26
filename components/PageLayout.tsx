
// components/PageLayout.tsx
'use client'
// Client wrapper for server-rendered content: the page fetches the data and renders
// `header` and the sections (children); this only adds the grid / single-column toggle.
// Used by the case page and the client page, each remembering its own choice.
import { useEffect, useState, type ReactNode } from 'react'

type Layout = 'grid' | 'single'

export function PageLayout({
  storageKey,
  header,
  children,
}: {
  storageKey: string // e.g. 'case-layout', 'client-layout'
  header: ReactNode
  children: ReactNode
}) {
  const [layout, setLayout] = useState<Layout>('grid')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'grid' || saved === 'single') setLayout(saved)
    } catch {}
  }, [storageKey])

  function toggle() {
    const next = layout === 'grid' ? 'single' : 'grid'
    setLayout(next)
    try { localStorage.setItem(storageKey, next) } catch {}
  }

  const isGrid = layout === 'grid'

  return (
    <main className={`mx-auto px-6 py-10 ${isGrid ? 'max-w-7xl' : 'max-w-3xl'}`}>
      <div className='mb-8 flex items-start gap-4'>
        <div className='min-w-0 flex-1'>{header}</div>
        <button
          type='button'
          onClick={toggle}
          className='hidden shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 lg:block'
        >
          {isGrid ? 'Single column' : 'Grid view'}
        </button>
      </div>

      <div className={isGrid ? 'space-y-8 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0' : 'space-y-8'}>
        {children}
      </div>
    </main>
  )
}