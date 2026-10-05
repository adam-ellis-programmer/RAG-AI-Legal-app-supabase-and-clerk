/*************************************
 The seed needs the same pipeline as real uploads
 a script can't import from a route
 ************************************/

// lib/ingest.ts
// The document pipeline: PDF → text → clean → chunk → embed → store.
// Shared by the upload route and the demo seed, so seeded documents are
// chunked exactly like real uploads. No Next.js imports here on purpose:
// a plain Node script must be able to load this file.
import { extractText, getDocumentProxy } from 'unpdf'
import { VoyageAIClient } from 'voyageai'
import { db } from '@/lib/db'
import { documents, documentFiles } from '@/lib/schema'
import { CHUNK_SIZE } from '@/lib/pagination'

export const CHUNK_OVERLAP = 150

export type Chunk = { content: string; start: number }

// Created on first use rather than at import time, so a script's
// environment is guaranteed to be loaded before the key is read.
let voyageClient: VoyageAIClient | null = null
function voyage() {
  voyageClient ??= new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
  return voyageClient
}

/** Collapse whitespace once. The stored full_text and the chunks use this same string. */
export function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/** Overlapping character windows over already-cleaned text. */
export function chunkText(clean: string): Chunk[] {
  if (!clean) return []
  const chunks: Chunk[] = []
  let start = 0
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length)
    chunks.push({ content: clean.slice(start, end), start })
    if (end === clean.length) break
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

/** Embed in batches of 100 to stay inside Voyage's per-request limits. */
export async function embedChunks(chunks: Chunk[]): Promise<number[][]> {
  const vectors: number[][] = []
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100).map((c) => c.content)
    const res = await voyage().embed({
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

/** Extract all text from a PDF's bytes. */
export async function pdfToText(bytes: ArrayBuffer) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const { text } = await extractText(pdf, { mergePages: true })
  return text
}

/** A problem with the input (the user's fault), as opposed to a server fault. */
export class IngestError extends Error {}

/**
 * Clean, chunk, embed and store one document. matterId null = firm law book.
 * createdAt is optional: real uploads use the database default; the seed backdates.
 */
export async function storeDocument(input: {
  orgId: string
  matterId: string | null
  uploadedBy: string
  source: string
  rawText: string
  createdAt?: Date
}) {
  const cleaned = cleanText(input.rawText)
  const chunks = chunkText(cleaned)
  if (chunks.length === 0) throw new IngestError('No text could be extracted.')

  // The slow part, OUTSIDE the transaction: no database connection is held
  // open while Voyage works.
  const embeddings = await embedChunks(chunks)
  if (embeddings.length !== chunks.length) {
    throw new Error('Embedding count did not match chunk count.')
  }

  // The quick part, INSIDE a transaction: the file and its chunks are saved
  // together or not at all. No half-stored document can ever exist.
  const fileId = await db.transaction(async (tx) => {
    const [fileRow] = await tx
      .insert(documentFiles)
      .values({
        orgId: input.orgId,
        matterId: input.matterId,
        uploadedBy: input.uploadedBy,
        source: input.source,
        fullText: cleaned,
        createdAt: input.createdAt, // undefined → column omitted → database default
      })
      .returning({ id: documentFiles.id })



      /** 
        i + j in the chunk loop: j counts within the current batch of 500 (0 to 499), and i is where that batch starts. So i + j is the chunk's position in the whole document, which is what chunkIndex and embeddings[...] need.
        The 500-row batches are new. Your current route inserts every chunk in one statement, and Postgres limits how many values a single statement can carry. A long enough book would fail. Batching inside the transaction keeps the all-or-nothing guarantee.
        IngestError lets the route tell "your PDF had no text" (a 400, the user's problem) from "something broke" (a 500, yours).
       */

    // Insert chunks 500 at a time. One huge insert can exceed Postgres's limit
    // on values per statement (about 65,000) for a very long book.
    for (let i = 0; i < chunks.length; i += 500) {
      await tx.insert(documents).values(
        chunks.slice(i, i + 500).map((chunk, j) => ({
          orgId: input.orgId,
          matterId: input.matterId,
          fileId: fileRow.id,
          source: input.source,
          chunkIndex: i + j,
          startChar: chunk.start,
          content: chunk.content,
          embedding: embeddings[i + j],
          createdAt: input.createdAt,
        })),
      )
    }
    return fileRow.id
  })

  return { id: fileId, chunks: chunks.length }
}
