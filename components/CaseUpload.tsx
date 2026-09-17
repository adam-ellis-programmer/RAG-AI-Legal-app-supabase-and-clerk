// components/CaseUpload.tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function CaseUpload({ matterId }: { matterId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPending(true)
    setError(null)
    setMessage(null)

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('matterId', matterId) // re-verified server-side by getMatterAccess

      const res = await fetch('/api/ingest', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      setMessage(`${data.source} uploaded (${data.chunks} chunks).`)
      router.refresh() // re-run the server page so the new doc appears in the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = '' // allow re-selecting the same file
    }
  }

  return (
    <div className='flex flex-wrap items-center gap-3'>
      <label
        className={`rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white ${
          pending
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:bg-slate-800'
        }`}
      >
        {pending ? 'Uploading & indexing…' : 'Upload document'}
        <input
          ref={inputRef}
          type='file'
          accept='application/pdf'
          className='hidden'
          disabled={pending}
          onChange={handleChange}
        />
      </label>
      {message && <span className='text-xs text-green-700'>{message}</span>}
      {error && <span className='text-xs text-red-600'>{error}</span>}
    </div>
  )
}
