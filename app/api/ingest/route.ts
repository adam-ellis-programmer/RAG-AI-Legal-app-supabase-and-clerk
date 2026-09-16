// app/api/ingest/route.ts
import { auth } from '@clerk/nextjs/server'
import { extractText, getDocumentProxy } from 'unpdf'
import { VoyageAIClient } from 'voyageai'
import { db } from '@/lib/db'
import { documents, documentFiles } from '@/lib/schema'

// unpdf needs Node APIs — it will not run on the Edge runtime.
export const runtime = 'nodejs'
// Give the function room to process larger PDFs once deployed (Vercel).
export const maxDuration = 60

// Temporary tenant id until Clerk is wired in. Every row needs an org_id
// (the column is NOT NULL), so during the single-tenant phase we stamp a placeholder.
// const DEV_ORG_ID = 'dev-placeholder-org'

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

// Split text into overlapping character windows. Overlap keeps sentences that
// straddle a boundary from being lost. Simple and predictable — a good starting
// point you can later upgrade to sentence-aware splitting.
function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length)
    chunks.push(clean.slice(start, end))
    if (end === clean.length) break
    start += chunkSize - overlap
  }
  return chunks
}

/**
 "This function takes the array of text chunks made earlier. 
  The outer loop steps i forward by 100 each iteration, and slice(i, i + 100) 
  grabs a batch of up to 100 chunks. Each batch is sent to Voyage, 
  which returns an embedding (a vector of numbers) for every chunk in it. 
  The inner loop pushes each of those embeddings into vectors. 
  After all batches are processed, vectors — one number-array per 
  chunk, in order — is returned."

  ----------------------------------------

  Embedding a document means converting its 
  text into vectors — running the chunks through 
  Voyage to get those number arrays. That's the 
  transformation step. It produces the embeddings 
  but doesn't save them anywhere yet; at that moment 
  the vectors are just sitting in memory inside your 
  function (the vectors array).

  overlap is a safty margin
  tennant wall
  source job is provenance -- This records where the chunk came from — the original filename or a label you pass
  the embedding finds the chunk the content is what gets used 
  embedding is an array of 1024 numbers -- this is the vector -- Voyage's numerical fingerprint of the content
   --  this is what the <=> operator compares against
   -- he entire reason RAG can match by concept rather than keyword
   -- Notice it's stored as text-looking here in the JSON view, but in the database it's a genuine vector(1024) type that pgvector can do distance math on

   time stanmp == when did this get ingested?
   So every column has a job in the round trip: embedding finds the chunk, content answers the question, source/chunk_index cite it, org_id keeps it private, and id/created_at keep the bookkeeping straight.
   ingestion pipeline



    data pipeline
    run the shared chunk → embed → store pipeline.


    web standard


 */

// Embed chunks in batches so a big document doesn't exceed Voyage's per-request limits.
async function embedChunks(chunks: string[]): Promise<number[][]> {
  const batchSize = 100
  const vectors: number[][] = [] // it's "the numerical embedding of each chunk

  for (let i = 0; i < chunks.length; i += batchSize) {
    //   grabbing a handful of already-made chunks (up to 100 of them) to send together.
    const batch = chunks.slice(i, i + batchSize)
    const res = await voyage.embed({
      input: batch,
      model: 'voyage-4',
      inputType: 'document', // storing for later search -> "document" (queries use "query")
    })
    for (const item of res.data ?? []) {
      if (item.embedding) vectors.push(item.embedding)
    }
  }
  return vectors
}

/**
 * The handler's job is: figure out where the text came
 * from, get it into one rawText string, then run the shared chunk → embed → store pipeline.
 * Everything before the pipeline is just "resolve the input"; everything after is identical
 * regardless of source. Let me focus on the setup lines you asked about, because they use a
 * couple of TypeScript idioms worth unpacking.
 */

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth()
    // prettier-ignore
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    // prettier-ignore
    if (!orgId) return Response.json({ error: 'No active organization selected.' }, { status: 400 })
    const form = await req.formData()
    const file = form.get('file')
    const pastedText = form.get('text')
    const sourceField = form.get('source')

    // Resolve the raw text from either a PDF upload or a pasted-text field.
    let rawText = ''
    let source =
      typeof sourceField === 'string' && sourceField ? sourceField : 'untitled'

    // ----- if this is a file ---------  Read top to bottom, it's a transformation pipeline where each line's output is the next line's input:
    if (file && typeof file !== 'string' && file.size > 0) {
      // PDF path: read the upload into a buffer and extract its text.

      // Read the file's raw bytes out of the Blob into an ArrayBuffer —
      // a block of raw binary memory (not readable/indexable on its own).
      const buffer = await file.arrayBuffer()

      // new Uint8Array(buffer): wrap the raw ArrayBuffer in a "view" that lets you
      // read it as a sequence of bytes (unsigned 8-bit ints, each 0–255).
      // getDocumentProxy: parse those bytes into a loaded PDF document object
      // you can then extract text/pages/images from.
      // line 2 turns raw bytes into a parsed PDF document (still no text yet). It's the "open and prepare the document" step, not the "get the words" step.
      //   gives you back a proxy to the document, not the document's contents laid bare.

      /**
       * So the mental model: PDFDocumentProxy is a "document handle" object,
       *  and most of what's inside it is the engine — the workers, factories,
       *  and loaders — that lets it decode and serve the PDF's content when asked.
       * The only human-meaningful bit is _pdfInfo (page count and fingerprint).
       * The text isn't sitting in this object in readable form; it's still locked
       * inside the parsed structure, and you get it out with the next line.
       */
      // open the document
      const pdf = await getDocumentProxy(new Uint8Array(buffer)) // PARSED PDF (RETURNED)

      //   console.log('PDF: ', pdf)

      // Pull the readable text out of the parsed PDF; mergePages joins all pages
      // into one string. Destructure just `text` from the returned object.
      // read the document
      const { text } = await extractText(pdf, { mergePages: true })
      //   console.log('text', text)

      //   pdf.destroy(). ???????

      rawText = text

      if (source === 'untitled') source = file.name || 'uploaded.pdf'

      // ----- if this is a pasted text ---------
    } else if (typeof pastedText === 'string' && pastedText.trim()) {
      // Pasted-text path: use it directly.
      rawText = pastedText
      if (source === 'untitled') source = 'pasted-text'
    } else {
      return Response.json(
        { error: 'Provide either a `file` (PDF) or a `text` field.' },
        { status: 400 },
      )
    }

    // Chunk -> embed -> store.
    const chunks = chunkText(rawText)
    // console.log('the chunks: ', chunks)

    if (chunks.length === 0) {
      return Response.json(
        { error: 'No text could be extracted.' },
        { status: 400 },
      )
    }

    const embeddings = await embedChunks(chunks)
    // console.log('embeddings: ', embeddings)

    if (embeddings.length !== chunks.length) {
      return Response.json(
        { error: 'Embedding count did not match chunk count.' },
        { status: 500 },
      )
    }

    await db.insert(documents).values(
      chunks.map((content, i) => ({
        orgId: orgId,
        source,
        chunkIndex: i,
        content,
        embedding: embeddings[i],
      })),
    )

    // Store the full text once, for the document viewer (chunks stay for the AI).
    await db.insert(documentFiles).values({ orgId, source, fullText: rawText })

    return Response.json({
      source,
      chunks: chunks.length,
      inserted: chunks.length,
    })
  } catch (err) {
    console.error('ingest error:', err)
    return Response.json(
      { error: 'Ingestion failed. Check server logs.' },
      { status: 500 },
    )
  }
}
