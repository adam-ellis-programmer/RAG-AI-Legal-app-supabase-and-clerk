// scripts/seed-demo/library.ts
// Stage 2: the firm library. Two fictional law books, stored through the same
// pipeline as a real upload (clean → chunk → embed → store).
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { storeDocument } from '@/lib/ingest'
import { ORG_ID, daysAgo } from './config'
import type { People } from './people'

// npm scripts always run from the project root, so this path is reliable.
const LAW_DIR = path.join(process.cwd(), 'scripts/seed-demo/docs/law')

const LAW_BOOKS = [
  {
    key: 'boundaries',
    file: 'boundaries-handbook.txt',
    source: 'Boundaries and Party Walls Handbook',
    uploadedBy: 'eleanor',
    daysAgo: 62,
  },
  {
    key: 'rightsOfWay',
    file: 'rights-of-way-guide.txt',
    source: 'Rights of Way and Access Guide',
    uploadedBy: 'daniel',
    daysAgo: 55,
  },
] as const

type LawKey = (typeof LAW_BOOKS)[number]['key'] // 'boundaries' | 'rightsOfWay'
export type Library = Record<LawKey, { id: string; source: string }>

export async function seedLibrary(people: People): Promise<Library> {
  const library = {} as Library

  // One at a time rather than all at once: simpler to follow in the logs,
  // and gentler on Voyage's rate limits.
  for (const book of LAW_BOOKS) {
    const rawText = await readFile(path.join(LAW_DIR, book.file), 'utf8')
    const stored = await storeDocument({
      orgId: ORG_ID,
      matterId: null, // null = firm library, visible to everyone in the firm
      uploadedBy: people[book.uploadedBy],
      source: book.source,
      rawText,
      createdAt: daysAgo(book.daysAgo),
    })
    library[book.key] = { id: stored.id, source: book.source }
    console.log(`  law book: ${book.source} (${stored.chunks} passages)`)
  }
  return library
}