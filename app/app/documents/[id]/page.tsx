// app/app/documents/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const PAGE_SIZE = 3000 // characters shown per page

export default async function DocumentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const { orgId } = await auth()
  if (!orgId) notFound()

  // 1. Fetch the title + total length only (an int, not the whole book).
  //    `and org_id` is the tenant wall: you cannot open another org's document,
  //    even by guessing its id.
  const meta = await db.execute(sql`
    select source, length(full_text) as len
    from document_files
    where id = ${id} and org_id = ${orgId}
  `)
  const row = meta.rows[0] as { source: string; len: number } | undefined
  if (!row) notFound()

  const total = Number(row.len)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(
    totalPages,
    Math.max(1, parseInt(sp.page ?? '1', 10) || 1),
  )
  const start = (page - 1) * PAGE_SIZE

  // 2. Pull ONLY the current page's slice from the database. This is what makes
  //    it scale to books - we never load the full document into memory.
  const slice = await db.execute(sql`
    select substring(full_text from ${start + 1} for ${PAGE_SIZE}) as page_text
    from document_files
    where id = ${id} and org_id = ${orgId}
  `)
  const pageText =
    (slice.rows[0] as { page_text: string } | undefined)?.page_text ?? ''

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='font-serif text-2xl text-slate-900'>{row.source}</h1>
          <p className='mt-1 text-sm text-slate-500'>
            Page {page} of {totalPages}
          </p>
        </div>
        <Link
          href='/app/documents'
          className='shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50'
        >
          All documents
        </Link>
      </div>

      <article className='whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800'>
        {pageText}
      </article>

      {totalPages > 1 && (
        <nav className='mt-6 flex items-center justify-between'>
          {page > 1 ? (
            <Link
              href={`/app/documents/${id}?page=${page - 1}`}
              className='rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50'
            >
              &larr; Previous
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link
              href={`/app/documents/${id}?page=${page + 1}`}
              className='rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50'
            >
              Next &rarr;
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  )
}
