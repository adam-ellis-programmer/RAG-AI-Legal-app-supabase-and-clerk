// app/app/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type Source = {
  n: number
  fileId: string | null
  source: string
  chunkIndex: number
  page: number | null
  startChar: number | null
  similarity: number
}
type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export default function Home() {
  // ----- ingestion state -----
  const [pasteText, setPasteText] = useState('')
  const [pasteSource, setPasteSource] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ----- chat state -----
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ----- ingestion actions -----
  // Main ingest function
  // prettier-ignore
  async function ingest(form: FormData) {
    setIngesting(true)
    setIngestMsg(null)
    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ingestion failed')
           setIngestMsg(`Added "${data.source}" to the firm library (${data.inserted} passages).`)
    } catch (e) {
      setIngestMsg(e instanceof Error ? e.message : 'Ingestion failed')
    } finally {
      setIngesting(false)
    }
  }

  // Paste
  function ingestPaste() {
    if (!pasteText.trim() || ingesting) return
    const form = new FormData()
    form.append('text', pasteText)
    if (pasteSource.trim()) form.append('source', pasteSource.trim())
    // --- call ingest function ---
    ingest(form).then(() => setPasteText(''))
  }

  // Upload File
  function ingestFiles(files: FileList | null) {
    if (!files || files.length === 0 || ingesting) return
    const file = files[0]
    const form = new FormData()
    form.append('file', file)
    form.append('source', file.name)
    // --- call ingest function ---
    ingest(form)
  }

  // ----- chat action -----
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: question }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      if (!res.ok || !res.body) {
        throw new Error(await res.text().catch(() => 'Request failed'))
      }

      // Pull the source list out of the response header.
      let sources: Source[] = []
      const raw = res.headers.get('X-Sources')
      // console.log('raw: ', raw)

      if (raw) {
        try {
          sources = JSON.parse(decodeURIComponent(raw))
          // console.log('sources: ', sources)
        } catch {
          /* ignore malformed header */
        }
      }

      setMessages((prev) => {
        const u = [...prev]
        u[u.length - 1] = { ...u[u.length - 1], sources }
        return u
      })

      // Stream the answer text token by token.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      // u = updated
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })

        setMessages((prev) => {
          const u = [...prev]
          const last = u[u.length - 1]
          // console.log('last', last)

          //  * So the line is doing: "replace the last message slot with a fresh copy of that message, identical except content now has the new chunk appended." You override the slot (yes), but with a new object that preserves the other fields and gives React something new to see.

          u[u.length - 1] = { ...last, content: last.content + chunk }
          return u
        })
      }
    } catch {
      setMessages((prev) => {
        const u = [...prev]
        u[u.length - 1] = {
          ...u[u.length - 1],
          content: 'Sorry — something went wrong. Please try again.',
        }
        return u
      })
    } finally {
      setLoading(false)
    }
  }

  // *** HAVE TO BE ADMIN TO UPLOAD HERE ***

  // ----- markup ----------

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-6'>
      <header>
        <h1 className='text-xl font-semibold text-zinc-900'>Firm library</h1>
        <p className='text-sm text-zinc-500'>
          Shared reference material — legislation, textbooks, precedents.
          Everyone in the firm can read these and ask questions about them.
        </p>
      </header>

      {/* ---------------- Ingestion panel ---------------- */}
      <section className='rounded-xl border border-zinc-200 bg-white p-4'>
        <h2 className='mb-1 text-sm font-semibold text-zinc-700'>
          Add to the firm library
        </h2>
        <p className='mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-200'>
          Anything added here is visible to everyone in the firm. Client files
          belong on their case, where only the case team can see them.{' '}
          <Link href='/app/clients' className='font-medium underline'>
            Go to clients
          </Link>
        </p>

        <div className='grid gap-4 md:grid-cols-2'>
          {/* Paste text */}
          <div className='flex flex-col gap-2'>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder='Paste document text here…'
              rows={5}
              className='w-full resize-y rounded-lg border border-zinc-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <input
              value={pasteSource}
              onChange={(e) => setPasteSource(e.target.value)}
              placeholder='Source label (optional)'
              className='w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <button
              onClick={ingestPaste}
              disabled={ingesting || !pasteText.trim()}
              className='rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50'
            >
              {ingesting ? 'Adding…' : 'Add to library'}
            </button>
          </div>

          {/* PDF drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              ingestFiles(e.dataTransfer.files)
            }}
            className={
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center text-sm transition ' +
              (dragActive
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-zinc-300 text-zinc-500 hover:border-zinc-400')
            }
          >
            <p className='font-medium'>Drop a reference PDF here</p>
            <p className='text-xs'>or click to browse</p>
            <input
              ref={fileInputRef}
              type='file'
              accept='application/pdf'
              className='hidden'
              onChange={(e) => ingestFiles(e.target.files)}
            />
          </div>
        </div>

        {ingestMsg && <p className='mt-3 text-sm text-zinc-600'>{ingestMsg}</p>}
      </section>

      {/* ---------------- Chat panel ---------------- */}
      <section className='flex flex-1 flex-col rounded-xl border border-zinc-200 bg-white'>
        <div
          className='flex-1 space-y-4 overflow-y-auto p-4'
          style={{ minHeight: 300 }}
        >
          {messages.length === 0 && (
            <p className='mt-8 text-center text-sm text-zinc-400'>
              Ask a question about the firm library. For questions about a
              client&apos;s case, open the case instead.
            </p>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'text-right' : 'text-left'}
            >
              <span
                className={
                  'inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ' +
                  (m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-900')
                }
              >
                {m.content || (loading ? '…' : '')}
              </span>
{/* this is some text text to be deleted: const test = "hello world k" */}
              {/* Citations under assistant answers */}
              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className='mt-2 text-left text-xs text-zinc-500'>
                  <p className='font-medium text-zinc-600'>Sources</p>
                  {/* prettier-ignore */}
                  <ul className='mt-1 space-y-0.5'>
                       {m.sources.map((s) => (
                      <li key={s.n}>
                        [{s.n}]{' '}
                        {s.page && s.fileId ? (
                          <a href={`/app/documents/${s.fileId}?page=${s.page}&from=cite&at=${s.startChar}#cited`} target='_blank' rel='noopener' className='underline underline-offset-2 hover:text-zinc-900'>
                            {s.source}
                          </a>
                        ) : (
                          s.source
                        )}{' '}
                        — page {s.page ?? '?'} ·{' '}
                        {(s.similarity * 100).toFixed(0)}% match
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* send message at bottom of chat */}
        <form
          onSubmit={sendMessage}
          className='flex gap-2 border-t border-zinc-200 p-3'
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Ask something…'
            disabled={loading}
            className='flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            type='submit'
            disabled={loading || !input.trim()}
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
          >
            {loading ? 'Thinking…' : 'Send'}
          </button>
        </form>
      </section>
    </main>
  )
}
