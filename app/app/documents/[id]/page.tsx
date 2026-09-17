// app/app/documents/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import PageJump from '@/components/PageJump'
import DocSearch from '@/components/DocSearch'

// isUuid turns a junk URL like /app/documents/abc into a clean 404 instead of a 500.
import { getMatterAccess, isUuid } from '@/lib/matter-access'
import { logAction } from '@/lib/audit'

const PAGE_SIZE = 3000 // characters shown per page

// Build a windowed list of page numbers: 1 … 47 48 [49] 50 51 … 477
function pageWindow(current: number, total: number): (number | '...')[] {
  const delta = 2 // pages either side of the current one
  const out: (number | '...')[] = []
  const range: number[] = []
  // create actual window with deltas
  for (
    let i = Math.max(1, current - delta);
    i <= Math.min(total, current + delta);
    i++
  ) {
    range.push(i)
  }
  if (range[0] > 1) {
    out.push(1)
    if (range[0] > 2) out.push('...')
  }
  out.push(...range)
  //
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) out.push('...')
    out.push(total)
  }
  return out
}

// Render text with the search term highlighted.
function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text
  const lower = text.toLowerCase()
  const t = term.toLowerCase()
  const parts: React.ReactNode[] = []
  let from = 0
  let i = lower.indexOf(t)
  let key = 0

  // does this loop start from the begining each time
  while (i !== -1) {
    parts.push(text.slice(from, i))
    parts.push(
      <mark key={key++} className='bg-yellow-200'>
        {text.slice(i, i + term.length)}
      </mark>,
    )
    from = i + term.length
    i = lower.indexOf(t, from)
  }
  parts.push(text.slice(from))
  return parts
}

export default async function DocumentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  // ***** edited *****

  const { userId, orgId } = await auth()
  if (!userId || !orgId) notFound()

  // A malformed id would make Postgres throw (500) instead of a clean 404.
  if (!isUuid(id)) notFound()

  /** matter_id is added to the select, so the page knows whether this file is a law book or a case document. */
  // LAYER 1 — firm wall: the file must belong to this org.
  const meta = await db.execute(sql`
    select source, matter_id, length(full_text) as len
    from document_files
    where id = ${id} and org_id = ${orgId}
  `)
  const row = meta.rows[0] as
    | { source: string; matter_id: string | null; len: number }
    | undefined
  if (!row) notFound()

  // LAYER 2 — ethical wall: a case document is only visible to that case's team.
  // Law books (matter_id null) stay firm-wide.
  if (row.matter_id) {
    const access = await getMatterAccess(row.matter_id)
    if (!access) notFound()
  }

  // ***** *****

  // Audit: log when the document is OPENED, not on every page turn or search.
  console.log(sp)

  if (!sp.page && !sp.q) {
    await logAction({
      orgId,
      userId,
      matterId: row.matter_id,
      action: 'document.view',
      targetType: 'document',
      targetId: id,
      detail: row.source,
    })
  }

  const total = Number(row.len)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(
    totalPages,
    Math.max(1, parseInt(sp.page ?? '1', 10) || 1),
  )
  const startPos = (page - 1) * PAGE_SIZE + 1

  // Only the current page's slice (scales to books).
  const slice = await db.execute(sql`
    select substring(full_text from ${sql.raw(String(startPos))} for ${sql.raw(String(PAGE_SIZE))}) as page_text
    from document_files
    where id = ${id} and org_id = ${orgId}
  `)
  const pageText =
    (slice.rows[0] as { page_text: string } | undefined)?.page_text ?? ''

  // ---- Search within the document ----
  const q = (sp.q ?? '').trim()
  let results: { page: number; count: number; snippet: string }[] = []
  if (q) {
    // Load the full text once, only when searching, and scan for the term.
    const res = await db.execute(sql`
      select full_text from document_files
      where id = ${id} and org_id = ${orgId}
    `)

    const fullText =
      (res.rows[0] as { full_text: string } | undefined)?.full_text ?? ''
    const lower = fullText.toLowerCase()
    const term = q.toLowerCase()
    const hits = new Map<number, { count: number; snippet: string }>()
    let i = lower.indexOf(term)

    while (i !== -1 && hits.size < 300) {
      const hitPage = Math.floor(i / PAGE_SIZE) + 1
      const existing = hits.get(hitPage)
      if (existing) {
        existing.count++
      } else {
        const snippet = fullText
          .slice(Math.max(0, i - 50), i + term.length + 50)
          .replace(/\s+/g, ' ')
          .trim()
        hits.set(hitPage, { count: 1, snippet })
      }
      i = lower.indexOf(term, i + term.length)
    }
    results = [...hits.entries()]
      .map(([p, info]) => ({ page: p, ...info }))
      .sort((a, b) => a.page - b.page)
  }

  const windowPages = pageWindow(page, totalPages)

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='font-serif text-2xl text-slate-900'>{row.source}</h1>
          <p className='mt-1 text-sm text-slate-500'>
            Page {page} of {totalPages}
          </p>
        </div>
        {/* prettier-ignore */}
        <Link
          href={row.matter_id ? `/app/matters/${row.matter_id}` : '/app/documents'}
          className='shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50'
        >
          {row.matter_id ? 'Back to case' : 'All documents'}
        </Link>
      </div>

      {/* Toolbar: search + jump-to-page */}
      <div className='mb-6 space-y-3'>
        <DocSearch documentId={id} initialQuery={q} />
        <div className='flex justify-end'>
          <PageJump
            documentId={id}
            totalPages={totalPages}
            currentPage={page}
          />
        </div>
      </div>

      {/* Search results */}
      {q && (
        <div className='mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4'>
          <p className='mb-2 text-sm font-medium text-slate-700'>
            {results.length === 0
              ? `No matches for “${q}”.`
              : `“${q}” found on ${results.length} page${results.length === 1 ? '' : 's'}:`}
          </p>
          <ul className='space-y-2'>
            {results.map((r) => (
              <li key={r.page}>
                <Link
                  href={`/app/documents/${id}?page=${r.page}&q=${encodeURIComponent(q)}`}
                  className='block rounded-md bg-white p-2 text-sm hover:bg-slate-100'
                >
                  <span className='font-medium text-slate-900'>
                    Page {r.page}
                  </span>{' '}
                  <span className='text-slate-400'>({r.count})</span>
                  <span className='mt-0.5 block text-slate-500'>
                    …{r.snippet}…
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className='whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800'>
        {q ? highlight(pageText, q) : pageText}
      </article>

      {/* Numbered navigation */}
      {totalPages > 1 && (
        <nav className='mt-6 flex flex-wrap items-center justify-center gap-1'>
          {page > 1 && (
            <Link
              href={`/app/documents/${id}?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className='rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-900 hover:bg-slate-50'
            >
              &larr;
            </Link>
          )}

          {windowPages.map((p, idx) =>
            p === '...' ? (
              <span key={`e${idx}`} className='px-2 text-slate-400'>
                &hellip;
              </span>
            ) : p === page ? (
              <span
                key={p}
                className='rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white'
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={`/app/documents/${id}?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className='rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-900 hover:bg-slate-50'
              >
                {p}
              </Link>
            ),
          )}

          {page < totalPages && (
            <Link
              href={`/app/documents/${id}?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className='rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-900 hover:bg-slate-50'
            >
              &rarr;
            </Link>
          )}
        </nav>
      )}
    </main>
  )
}
