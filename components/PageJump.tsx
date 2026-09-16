// components/PageJump.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PageJump({
  documentId,
  totalPages,
  currentPage,
}: {
  documentId: string
  totalPages: number
  currentPage: number
}) {
  const router = useRouter()
  const [value, setValue] = useState(String(currentPage))

  function go(e: React.FormEvent) {
    e.preventDefault()
    let n = parseInt(value, 10)
    if (Number.isNaN(n)) return
    n = Math.min(totalPages, Math.max(1, n)) // clamp into range
    router.push(`/app/documents/${documentId}?page=${n}`)
  }

  return (
    <form onSubmit={go} className="flex items-center gap-2">
      <label className="text-sm text-slate-500">Go to page</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <span className="text-sm text-slate-400">/ {totalPages}</span>
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        Go
      </button>
    </form>
  )
}