// app/app/documents/page.tsx
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export default async function DocumentsPage() {
  const { orgId } = await auth()

  if (!orgId) {
    return (
      <main className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='text-slate-600'>
          Select an organization to view its documents.
        </p>
      </main>
    )
  }

  // One row per uploaded document, scoped to the active org (the tenant wall).
  // `left(full_text, 160)` fetches only a short preview - never the whole book.
  let docs: Array<{
    id: string
    source: string
    created_at: string
    preview: string
  }> = []

  try {
    const result = await db.execute(sql`
      select id, source, created_at, left(full_text, 160) as preview
      from document_files
      where org_id = ${orgId}
      order by created_at desc
    `)
    docs = result.rows as typeof docs
    
  } catch (err) {
    console.error('documents query failed:', err)
    return (
      <main className='mx-auto max-w-3xl px-6 py-16 text-center'>
        <p className='text-slate-600'>
          Something went wrong loading your documents. Please try again.
        </p>
      </main>
    )
  }

  // old way:
  //   const docs = result.rows as Array<{
  //     id: string
  //     source: string
  //     created_at: string
  //     preview: string
  //   }>

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <div className='mb-8 flex items-center justify-between'>
        <div>
          <h1 className='font-serif text-2xl text-slate-900'>Documents</h1>
          <p className='mt-1 text-sm text-slate-500'>
            Everything your organisation has uploaded.
          </p>
        </div>
        <Link
          href='/app'
          className='rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50'
        >
          Back to assistant
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className='rounded-xl border border-dashed border-slate-300 p-10 text-center'>
          <p className='text-slate-500'>No documents yet.</p>
          <Link
            href='/app'
            className='mt-2 inline-block text-sm font-medium text-slate-900 underline'
          >
            Upload your first document
          </Link>
        </div>
      ) : (
        <ul className='space-y-3'>
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/app/documents/${doc.id}`}
                className='block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50'
              >
                <div className='flex items-center justify-between'>
                  <span className='font-medium text-slate-900'>
                    {doc.source}
                  </span>
                  <span className='text-xs text-slate-400'>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className='mt-1 line-clamp-2 text-sm text-slate-500'>
                  {doc.preview}&hellip;
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
