// app/api/ingest/route.ts
import { auth } from '@clerk/nextjs/server'
import { extractText, getDocumentProxy } from 'unpdf'
import { VoyageAIClient } from 'voyageai'
import { db } from '@/lib/db'
import { documents, documentFiles } from '@/lib/schema'

import { eq } from 'drizzle-orm'
import { getMatterAccess } from '@/lib/matter-access'
import { logAction } from '@/lib/audit'
import { isDemoOrg } from '@/lib/demo'

// unpdf needs Node APIs — it will not run on the Edge runtime.
export const runtime = 'nodejs'
// Give the function room to process larger PDFs once deployed (Vercel).
export const maxDuration = 60

// Temporary tenant id until Clerk is wired in. Every row needs an org_id
// (the column is NOT NULL), so during the single-tenant phase we stamp a placeholder.
// const DEV_ORG_ID = 'dev-placeholder-org'

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

// ---------------------------------------------------------
// Split text into overlapping character windows. Overlap keeps sentences that
// straddle a boundary from being lost. Simple and predictable — a good starting
// point you can later upgrade to sentence-aware splitting.
// ---------------------------------------------------------
/** ===== ADDED IN AND CHANGED FOR START CHAR CODE ===== */
type Chunk = { content: string; start: number }

// Collapse whitespace ONCE, here. The cleaned text is what we store as
// full_text and what we cut into chunks, so a chunk's `start` is a real
// position in the stored document — which is how citations find their page.
export function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

// Split cleaned text into overlapping character windows. Overlap keeps
// sentences that straddle a boundary from being lost.
function chunkText(clean: string, chunkSize = 1000, overlap = 150): Chunk[] {
  if (!clean) return []

  const chunks: Chunk[] = []
  let start = 0
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length)
    chunks.push({ content: clean.slice(start, end), start })
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
/** ===== updated for startChar code ===== */

// Embed chunks in batches so a big document doesn't exceed Voyage's per-request limits.
async function embedChunks(chunks: Chunk[]): Promise<number[][]> {
  const batchSize = 100
  const vectors: number[][] = []

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((c) => c.content)
    const res = await voyage.embed({
      input: batch,
      model: 'voyage-4',
      inputType: 'document',
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

    if (isDemoOrg(orgId)) {
      return Response.json(
        { error: 'This is a read-only demo — uploads are disabled.' },
        { status: 403 },
      )
    }

    // prettier-ignore
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    // prettier-ignore
    if (!orgId) return Response.json({ error: 'No active organization selected.' }, { status: 400 })
    const form = await req.formData()
    const file = form.get('file')
    const pastedText = form.get('text')
    const sourceField = form.get('source')

    // ******* added in ******
    // A case ID means the file is for a case. null means it's a firm-wide law book.
    // It only runs for case uploads, and it asks two questions:
    // A law book upload skips the guard, because there's no case to check. Any member of the firm can still add law books, as before.

    // Optional: which case this upload belongs to. No matterId = firm-wide law book.
    const matterIdField = form.get('matterId')
    const matterId =
      typeof matterIdField === 'string' && matterIdField ? matterIdField : null

    // Layers 1 + 2: you can only upload into a case you're on the team for.
    // Checked BEFORE parsing/embedding, so a rejected upload costs nothing.
    if (matterId) {
      const access = await getMatterAccess(matterId)
      if (!access) {
        return Response.json({ error: 'Case not found.' }, { status: 404 })
      }

      // NEW: no uploads to a closed or archived case.
      if (access.matter.status !== 'open') {
        return Response.json(
          { error: 'This case is closed. Reopen it to add documents.' },
          { status: 409 },
        )
      }
    }

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

      // Pull the readable text out of the parsed PDF; mergePages joins all pages
      // into one string. Destructure just `text` from the returned object.
      // read the document
      const { text } = await extractText(pdf, { mergePages: true })

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

    /** ===== changed because of start char code ===== */
    // Chunk -> embed -> store.
    // const chunks = chunkText(rawText)
    // Clean once; store and chunk the SAME string so offsets line up.
    const cleaned = cleanText(rawText)
    const chunks = chunkText(cleaned)

    if (chunks.length === 0) {
      return Response.json(
        { error: 'No text could be extracted.' },
        { status: 400 },
      )
    }

    const embeddings = await embedChunks(chunks)

    if (embeddings.length !== chunks.length) {
      return Response.json(
        { error: 'Embedding count did not match chunk count.' },
        { status: 500 },
      )
    }

    // 1. Store the full text FIRST so we get its id back.
    const [fileRow] = await db
      .insert(documentFiles)
      .values({
        orgId,
        matterId,
        uploadedBy: userId,
        source,
        fullText: cleaned,
      })
      .returning({ id: documentFiles.id })

    // 2. Store the chunks, each linked to its file (and case, if any).
    try {
      await db.insert(documents).values(
        chunks.map((chunk, i) => ({
          orgId,
          matterId,
          fileId: fileRow.id,
          source,
          chunkIndex: i,
          startChar: chunk.start,
          content: chunk.content,
          embedding: embeddings[i],
        })),
      )
    } catch (err) {
      // Don't leave a file behind with no searchable chunks.
      await db.delete(documentFiles).where(eq(documentFiles.id, fileRow.id))
      throw err
    }

    // 3. Audit: who uploaded what, into which case.
    await logAction({
      orgId,
      userId,
      matterId,
      action: 'document.uploaded',
      targetType: 'document',
      targetId: fileRow.id,
      detail: source,
    })

    return Response.json({
      id: fileRow.id,
      source,
      chunks: chunks.length,
      inserted: chunks.length,
    })

    /** ************ ************ *********************************
        Two things changed here:
        The order is reversed. The file row is inserted first, because the chunks need its ID for fileId.
        Failed chunk inserts are cleaned up. If the chunk insert fails, the file row is deleted, so the documents list never shows a file the AI can't search.
        Your main uploader on /app doesn't send a matterId, so it keeps creating firm-wide law books exactly as before.
          
     * ************ ************ *********************************/
  } catch (err) {
    console.error('ingest error:', err)
    return Response.json(
      { error: 'Ingestion failed. Check server logs.' },
      { status: 500 },
    )
  }
}
