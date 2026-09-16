// components/DocSearch.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DocSearch({
  documentId,
  initialQuery = '',
}: {
  documentId: string
  initialQuery?: string
}) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)

  function search(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    // Empty search clears back to the plain document view.
    router.push(
      term
        ? `/app/documents/${documentId}?q=${encodeURIComponent(term)}`
        : `/app/documents/${documentId}`,
    )
  }

  return (
    <form onSubmit={search} className="flex items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search this document…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <button
        type="submit"
        className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Search
      </button>
    </form>
  )
}