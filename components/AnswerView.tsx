// components/AnswerView.tsx
// This moves the answer rendering out of CaseQuery, so the live answer and a saved one look identical.
// Renders an answer and its cited sources. Used for live answers (CaseQuery)
// and saved ones (the query history page), so both look and link the same.
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import type { QuerySource } from '@/lib/schema'

// Turn [1], [2] in the answer into links that jump to the matching source below.
/**
 *
 * A conversation shows several answers on one page, and each has its own source-1.
 * Two elements with the same ID break the jump links, so each turn gets a prefix.
 *
 */
function linkCitations(text: string, anchor: string) {
  return text.replace(/\[(\d+)\]/g, `[\\[$1\\]](#${anchor}source-$1)`)
}
// prettier-ignore
export function AnswerMarkdown({ text, anchor = '' }: { text: string; anchor?: string }) {
  return (
    <div className='rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800'>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className='mb-3 last:mb-0'>{children}</p>,
          strong: ({ children }) => <strong className='font-semibold text-slate-900'>{children}</strong>,
          em: ({ children }) => <em className='italic'>{children}</em>,
          h1: ({ children }) => <h3 className='mb-2 mt-4 font-semibold text-slate-900 first:mt-0'>{children}</h3>,
          h2: ({ children }) => <h3 className='mb-2 mt-4 font-semibold text-slate-900 first:mt-0'>{children}</h3>,
          h3: ({ children }) => <h3 className='mb-2 mt-4 font-semibold text-slate-900 first:mt-0'>{children}</h3>,
          ul: ({ children }) => <ul className='mb-3 list-disc space-y-1 pl-5'>{children}</ul>,
          ol: ({ children }) => <ol className='mb-3 list-decimal space-y-1 pl-5'>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
         a: ({ href, children }) => // <-- changed the badge test to cover prefixed anchors:
            href?.startsWith('#') && href.includes('source-') ? (
              <a href={href} className='mx-0.5 rounded bg-slate-200 px-1 text-xs font-medium text-slate-700 no-underline hover:bg-slate-300'>{children}</a>
            ) : (
              <a href={href} className='underline' target='_blank' rel='noreferrer'>{children}</a>
            ),
        }}
      >
         {linkCitations(text, anchor)}
      </ReactMarkdown>
    </div>
  )
}

// prettier-ignore
export function SourceList({ sources, anchor = '' }: { sources: QuerySource[]; anchor?: string }) {
  if (sources.length === 0) return null
  return (
    <div>
      <h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>Sources</h3>
      <ul className='space-y-1 text-sm'>
        {sources.map((s) => ( //<--The saved-answer page doesn't pass anchor, so it keeps working unchanged.
            <li key={s.n} id={`${anchor}source-${s.n}`} className='flex scroll-mt-4 items-center gap-2'>
            <span className='w-8 shrink-0 text-slate-400'>[{s.n}]</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${s.kind === 'case' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
              {s.kind === 'case' ? 'Case' : 'Law'}
            </span>
            <Link
              href={s.page ? `/app/documents/${s.fileId}?page=${s.page}&from=cite&at=${s.startChar}#cited` : `/app/documents/${s.fileId}`}
              prefetch={false}
              target='_blank'
              rel='noopener'
              className='truncate text-slate-700 underline-offset-2 hover:underline'
            >
              {s.source}
            </Link>
            <span className='ml-auto shrink-0 text-xs text-slate-400'>
              {s.page ? `page ${s.page}` : `chunk ${s.chunkIndex}`} · {s.similarity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
