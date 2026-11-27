// lib/ai/embeddings.ts
// Turning text into vectors. The only file that talks to the embedding provider.
// No Next.js imports: the seed scripts use it too.
import { VoyageAIClient } from 'voyageai'
import { AI } from './config'

// Created on first use, so a script's env vars are loaded before the key is read.
let voyageClient: VoyageAIClient | null = null
function voyage() {
  voyageClient ??= new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
  return voyageClient
}

const BATCH = 100 // Voyage's per-request limit
/** Embed in batches of 100 to stay inside Voyage's per-request limits. */
async function embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]> {
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = await voyage().embed({
      input: texts.slice(i, i + BATCH),
      model: AI.embedding.model,
      inputType: kind, // Voyage tunes vectors differently for documents and for questions
    })
    for (const item of res.data ?? []) {
      if (!item.embedding) throw new Error('The embedding provider returned an empty vector.')
      // Guard the database: a wrong-sized vector would fail on insert, or worse, give nonsense matches.
      if (item.embedding.length !== AI.embedding.dimensions) {
        throw new Error(
          `Embedding has ${item.embedding.length} numbers; the database expects ${AI.embedding.dimensions}.`,
        )
      }
      vectors.push(item.embedding)
    }
  }
  if (vectors.length !== texts.length) throw new Error('Embedding count did not match input count.')
  return vectors
}

/** Vectors for document chunks (when storing). */
export function embedDocuments(texts: string[]) {
  return embed(texts, 'document')
}

/** One vector for a question (when searching). */
export async function embedQuery(text: string) {
  const [vector] = await embed([text], 'query')
  return vector
}

/** pgvector's text format, "[0.1,0.2,…]", for use in SQL as ${toVectorLiteral(v)}::vector. */
export function toVectorLiteral(vector: number[]) {
  return `[${vector.join(',')}]`
}

/*
 * Changing the embedding model (or provider) later:
 * 1. Every stored vector must be re-made with the new model: old and new can't be compared.
 * 2. If the new model's vectors are a different length, the column (and its HNSW index)
 *    in lib/schema.ts must change size too.
 * So it's a planned migration with a re-embed script, never just a setting.
 */