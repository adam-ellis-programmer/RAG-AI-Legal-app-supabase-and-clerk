// components/SearchablePanel.tsx
// "How this document became searchable": the ingest pipeline, shown with this
// document's real numbers from the database. Pure rendering, no hooks, so the
// server-rendered document page can use it directly.

// <details> and <summary> are built-in HTML for a collapsible section. They need no JavaScript or state, so the panel stays a plain server component.
import Link from 'next/link'
import { CHUNK_SIZE, PAGE_SIZE, pageForChar } from '@/lib/pagination'
import { CHUNK_OVERLAP } from '@/lib/ingest'

type ChunkInfo = { chunkIndex: number; startChar: number | null }

export function SearchablePanel({
  documentId,
  totalChars,
  chunks,
  sampleVector,
}: {
  documentId: string
  totalChars: number
  chunks: ChunkInfo[]
  sampleVector: number[]
}) {
  // Show the first few offsets and the last, rather than a long list.
  const shown = chunks.length > 6 ? [...chunks.slice(0, 4), null, chunks.at(-1)!] : chunks
  // A chunk from the middle makes a good demo citation, ideally past page 1.
  const demo = chunks[Math.floor(chunks.length / 2)]
  const demoStart = demo?.startChar ?? 0
  const demoPage = pageForChar(demoStart) ?? 1

  return (
    <details className='mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700'>
      <summary className='cursor-pointer font-medium text-slate-900'>
        How this document became searchable
      </summary>

      <ol className='mt-4 space-y-4'>
        <li>
          <p className='font-medium text-slate-900'>1. Extracted and cleaned</p>
          <p>{totalChars.toLocaleString()} characters of text, with whitespace collapsed so every position is exact.</p>
        </li>

        <li>
          <p className='font-medium text-slate-900'>2. Split into passages</p>
          <p>
            {chunks.length} chunks of up to {CHUNK_SIZE.toLocaleString()} characters, each overlapping the
            last by {CHUNK_OVERLAP} so no sentence is lost at a boundary. Each records where it starts:
          </p>
          <p className='mt-1 font-mono text-xs text-slate-500'>
            {shown.map((c, i) =>
              c === null ? <span key={i}> … </span> : (
                <span key={i}>#{c.chunkIndex} at {(c.startChar ?? 0).toLocaleString()}{i < shown.length - 1 ? ' · ' : ''}</span>
              ),
            )}
          </p>
        </li>

        <li>
          <p className='font-medium text-slate-900'>3. Turned into vectors</p>
          <p>
            Each chunk was sent to Voyage (voyage-4), which returns {sampleVector.length.toLocaleString()} numbers
            describing its meaning. Similar meanings give similar numbers. Chunk #0 begins:
          </p>
          <p className='mt-1 break-all font-mono text-xs text-slate-500'>
            [{sampleVector.slice(0, 6).map((v) => v.toFixed(4)).join(', ')}, … {sampleVector.length - 6} more]
          </p>
        </li>

        <li>
          <p className='font-medium text-slate-900'>4. Found and cited</p>
          <p>
            A question is turned into a vector the same way and compared with every chunk&apos;s vector. The closest
            are passed to Claude to answer from. Citations use the chunk&apos;s start position to find its page:
            {' '}{demoStart.toLocaleString()} ÷ {PAGE_SIZE.toLocaleString()} characters per page = page {demoPage}.
          </p>
          {demo && (
            <Link
              href={`/app/documents/${documentId}?page=${demoPage}&from=cite&at=${demoStart}#cited`}
              className='mt-2 inline-block text-slate-900 underline underline-offset-2'
            >
              Open chunk #{demo.chunkIndex} as a citation would →
            </Link>
          )}
        </li>
      </ol>
    </details>
  )
}