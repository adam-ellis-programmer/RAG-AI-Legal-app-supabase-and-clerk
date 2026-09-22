// components/CaseQuery.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AnswerMarkdown, SourceList } from '@/components/AnswerView'
import type { QuerySource } from '@/lib/schema'

type Doc = { id: string; source: string }
type Turn = { question: string; answer: string; sources: QuerySource[]; queryId: string | null }

const MAX_FILES = 20

export function CaseQuery({
  matterId,
  caseDocs,
  lawBooks,
}: {
  matterId: string
  caseDocs: Doc[]
  lawBooks: Doc[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setGroup(docs: Doc[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const d of docs) {
        if (on) next.add(d.id)
        else next.delete(d.id)
      }
      return next
    })
  }

  // Update the turn currently being answered (always the last one).
  function updateLast(patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) {
    setTurns((prev) => {
      const last = prev[prev.length - 1]
      const change = typeof patch === 'function' ? patch(last) : patch
      return [...prev.slice(0, -1), { ...last, ...change }]
    })
  }

  function newConversation() {
    setTurns([])
    setThreadId(null)
    setError(null)
  }

  async function ask() {
    const q = question.trim()
    if (pending || !q) return
    setPending(true)
    setError(null)
    setQuestion('')
    setTurns((prev) => [...prev, { question: q, answer: '', sources: [], queryId: null }])

    try {
      const res = await fetch(`/api/matters/${matterId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, fileIds: [...selected], threadId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Query failed')
      }

      // Headers arrive before the body, so sources can show straight away.
      const raw = res.headers.get('X-Sources')
      updateLast({
        sources: raw ? JSON.parse(decodeURIComponent(raw)) : [],
        queryId: res.headers.get('X-Query-Id'),
      })
      setThreadId(res.headers.get('X-Thread-Id'))

      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        updateLast((t) => ({ answer: t.answer + chunk }))
      }
      router.refresh() // pick up the new entry in Research history
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed')
      setTurns((prev) => prev.slice(0, -1)) // drop the unanswered turn
      setQuestion(q) // give the question back so it can be retried
    } finally {
      setPending(false)
    }
  }

  const tooMany = selected.size > MAX_FILES
  const canAsk = !pending && question.trim() && selected.size > 0 && !tooMany
  const inConversation = turns.length > 0

  function Group({ title, docs, empty }: { title: string; docs: Doc[]; empty: string }) {
    const allOn = docs.length > 0 && docs.every((d) => selected.has(d.id))
    return (
      <div>
        <div className='mb-2 flex items-center justify-between'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>{title}</h3>
          {docs.length > 0 && (
            <button type='button' onClick={() => setGroup(docs, !allOn)} className='text-xs text-slate-500 hover:text-slate-900'>
              {allOn ? 'Clear' : 'Select all'}
            </button>
          )}
        </div>
        {docs.length === 0 ? (
          <p className='text-xs text-slate-400'>{empty}</p>
        ) : (
          <ul className='space-y-1'>
            {docs.map((d) => (
              <li key={d.id}>
                <label className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50'>
                  <input type='checkbox' checked={selected.has(d.id)} onChange={() => toggle(d.id)} className='h-4 w-4 accent-slate-900' />
                  <span className='truncate'>{d.source}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className='space-y-4 rounded-xl border border-slate-200 p-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Group title='Case documents' docs={caseDocs} empty='No documents on this case yet.' />
        <Group title='Law books' docs={lawBooks} empty='No firm law books uploaded yet.' />
      </div>

      {/* The conversation so far */}
      {turns.map((t, i) => {
        const anchor = `t${i}-`
        const answering = pending && i === turns.length - 1
        return (
          <div key={i} className='space-y-3 border-t border-slate-200 pt-4'>
            <p className='text-sm font-medium text-slate-900'>
              {i > 0 && <span className='mr-1 text-xs font-normal text-slate-400'>Follow-up:</span>}
              {t.question}
            </p>
            {t.answer ? (
              <AnswerMarkdown text={t.answer} anchor={anchor} />
            ) : (
              <p className='text-sm text-slate-500'>Searching the ticked documents…</p>
            )}
            <SourceList sources={t.sources} anchor={anchor} />
            {t.queryId && !answering && (
              <p className='text-xs text-slate-500'>
                Saved to research history.{' '}
                <Link href={`/app/matters/${matterId}/queries/${t.queryId}`} className='underline'>
                  Open saved answer
                </Link>
              </p>
            )}
          </div>
        )
      })}

      {/* Ask, or follow up */}
      <div className={inConversation ? 'border-t border-slate-200 pt-4' : ''}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder={inConversation ? 'Ask a follow-up about this answer…' : 'e.g. Based on the handbook, how strong is Mr Johnson’s adverse possession argument?'}
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
        />
        <div className='mt-2 flex items-center justify-between gap-3'>
          <span className={`text-xs ${tooMany ? 'text-red-600' : 'text-slate-400'}`}>
            {selected.size} selected{tooMany ? ` (max ${MAX_FILES})` : ''}
          </span>
          <div className='flex gap-2'>
            {inConversation && !pending && (
              <button type='button' onClick={newConversation} className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'>
                New question
              </button>
            )}
            <button type='button' onClick={ask} disabled={!canAsk} className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'>
              {pending ? 'Thinking…' : inConversation ? 'Ask follow-up' : 'Ask'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className='text-sm text-red-600'>{error}</p>}
    </div>
  )
}