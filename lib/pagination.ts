// lib/pagination.ts
//
// One definition of "how long is a page", shared by the two places that need it:
//
//   1. app/app/documents/[id]/page.tsx — slices full_text into pages for the viewer
//   2. app/api/matters/[id]/query/route.ts — turns a chunk's start_char into a page
//      number so a citation can link straight to it
//
// If those two ever used different numbers, nothing would throw. Citations would
// simply point at the wrong page, and the further into a document you went, the
// more wrong they would be. Keeping the number here means they cannot drift apart.

/** Characters of document text shown per page in the viewer. */
export const PAGE_SIZE = 3000


/** How long each chunk is at ingest (see chunkText in the ingest route). */
export const CHUNK_SIZE = 1000

/**
 * Which page a chunk appears on, from where it starts in the document's text.
 *
 * start_char is recorded at ingest time (see app/api/ingest/route.ts). Chunks
 * ingested before that column existed have null, so callers get null back and
 * should link to the document without a page number rather than guessing.
 */
export function pageForChar(startChar: number | null | undefined) {
  if (startChar == null) return null
  return Math.floor(startChar / PAGE_SIZE) + 1
}
