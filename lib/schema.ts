// we added
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  vector,
  index,
} from 'drizzle-orm/pg-core'

// lib/schema.ts — defines the documents table in TypeScript:
// prettier-ignore
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),          // Clerk organization id — the tenant wall
    source: text("source").notNull(),          // original filename
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(), // Voyage voyage-4
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("documents_org_id_idx").on(t.orgId),
    index("documents_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ]
);

/**
 * TRY AND WRITE API OUT BY HAND TO REALLY UNDERSTAND IT!
 * 
 * create extension vector
 * switches on pgvector,
 * and pgvector is what gives you both 
 * the vector column type (to store the embeddings) 
 * and the <=> operator (to measure distance between 
 * them). They come as a package: no extension, 
 * no vector type, no <=>. So yes, it's 
 * there specifically because your AI 
 * retrieval depends on storing and 
 * comparing vectors.
 * we're using vectors to make the AI's answers searchable by meaning." 
 */
