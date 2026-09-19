// components/CaseQuery.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
type Doc = { id: string; source: string }

type Source = {
  n: number
  fileId: string
  source: string
  kind: 'case' | 'law'
  chunkIndex: number
  page: number | null
  startChar: number | null
  similarity: number
}

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      // toggle (flips)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      console.log('toggle next: ', next)

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
      console.log('setGroup next: ', on, next)

      return next
    })
  }

  async function ask() {
    if (pending) return
    setPending(true)
    setError(null)
    setAnswer('')
    setSources([])
    //
    try {
      const res = await fetch(`/api/matters/${matterId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, fileIds: [...selected] }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Query failed')
      }

      // Headers arrive before the body, so sources can show straight away.
      const raw = res.headers.get('X-Sources')
      if (raw) setSources(JSON.parse(decodeURIComponent(raw)))

      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed')
    } finally {
      setPending(false)
    }
  }

  const tooMany = selected.size > MAX_FILES
  const canAsk = !pending && question.trim() && selected.size > 0 && !tooMany

  // Turn [1], [2] in the answer into links that jump to the matching source below.
  function linkCitations(text: string) {
    return text.replace(/\[(\d+)\]/g, '[\\[$1\\]](#source-$1)')
  }

  function Group({
    title,
    docs,
    empty,
  }: {
    title: string
    docs: Doc[]
    empty: string
  }) {
    const allOn = docs.length > 0 && docs.every((d) => selected.has(d.id))

    return (
      <div>
        <div className='mb-2 flex items-center justify-between'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
            {title}
          </h3>
          {docs.length > 0 && (
            <button
              type='button'
              onClick={() => setGroup(docs, !allOn)}
              className='text-xs text-slate-500 hover:text-slate-900'
            >
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
                  <input
                    type='checkbox'
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className='h-4 w-4 accent-slate-900'
                  />
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
        <Group
          title='Case documents'
          docs={caseDocs}
          empty='No documents on this case yet.'
        />
        <Group
          title='Law books'
          docs={lawBooks}
          empty='No firm law books uploaded yet.'
        />
      </div>

      <div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder='e.g. Based on the handbook, how strong is Mr Johnson’s adverse possession argument?'
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'
        />
        <div className='mt-2 flex items-center justify-between'>
          <span
            className={`text-xs ${tooMany ? 'text-red-600' : 'text-slate-400'}`}
          >
            {selected.size} selected{tooMany ? ` (max ${MAX_FILES})` : ''}
          </span>
          <button
            type='button'
            onClick={ask}
            disabled={!canAsk}
            className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {pending ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </div>

      {error && <p className='text-sm text-red-600'>{error}</p>}

      {/* {answer && (
        <div className='whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800'>
          {answer}
        </div>
      )} */}

      {answer && (
        <div className='rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800'>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className='mb-3 last:mb-0'>{children}</p>,
              strong: ({ children }) => (
                <strong className='font-semibold text-slate-900'>
                  {children}
                </strong>
              ),
              em: ({ children }) => <em className='italic'>{children}</em>,
              h1: ({ children }) => (
                <h3 className='mb-2 mt-4 font-semibold text-slate-900 first:mt-0'>
                  {children}
                </h3>
              ),
              h2: ({ children }) => (
                <h3 className='mb-2 mt-4 font-semibold text-slate-900 first:mt-0'>
                  {children}
                </h3>
              ),
              h3: ({ children }) => (
                <h3 className='mb-2 mt-4 font-semibold text-slate-900 first:mt-0'>
                  {children}
                </h3>
              ),
              ul: ({ children }) => (
                <ul className='mb-3 list-disc space-y-1 pl-5'>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className='mb-3 list-decimal space-y-1 pl-5'>{children}</ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              a: ({ href, children }) =>
                href?.startsWith('#source-') ? (
                  <a
                    href={href}
                    className='mx-0.5 rounded bg-slate-200 px-1 text-xs font-medium text-slate-700 no-underline hover:bg-slate-300'
                  >
                    {children}
                  </a>
                ) : (
                  <a
                    href={href}
                    className='underline'
                    target='_blank'
                    rel='noreferrer'
                  >
                    {children}
                  </a>
                ),
            }}
          >
            {linkCitations(answer)}
          </ReactMarkdown>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Sources
          </h3>
          <ul className='space-y-1 text-sm'>
            {sources.map((s) => (
              <li
                key={s.n}
                id={`source-${s.n}`}
                className='flex scroll-mt-4 items-center gap-2'
              >
                <span className='w-8 shrink-0 text-slate-400'>[{s.n}]</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    s.kind === 'case'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s.kind === 'case' ? 'Case' : 'Law'}
                </span>
                <Link
                  href={
                    s.page
                      ? `/app/documents/${s.fileId}?page=${s.page}&from=cite&at=${s.startChar}#cited`
                      : `/app/documents/${s.fileId}`
                  }
                  prefetch={false}
                  target='_blank'
                  rel='noopener'
                  className='truncate text-slate-700 underline-offset-2 hover:underline'
                >
                  {s.source}
                </Link>
                <span className='ml-auto shrink-0 text-xs text-slate-400'>
                  {s.page ? `page ${s.page}` : `chunk ${s.chunkIndex}`} ·{' '}
                  {s.similarity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
