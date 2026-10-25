// components/CaseLayout.tsx
'use client'
// The case page's layout switch: a three-column grid or a single column.
// `header` sits on top beside the button; `children` (the sections) go in the grid.
import { useEffect, useState, type ReactNode } from 'react'

type Layout = 'grid' | 'single'
const STORAGE_KEY = 'case-layout'

export function CaseLayout({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [layout, setLayout] = useState<Layout>('grid')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'grid' || saved === 'single') setLayout(saved)
    } catch {}
  }, [])

  function toggle() {
    const next = layout === 'grid' ? 'single' : 'grid'
    setLayout(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
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

      <div className={isGrid ? 'space-y-8 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0 ' : 'space-y-8'}>
        {children} 
      </div>
    </main>
  )
}