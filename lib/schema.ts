// we added
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  vector,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// lib/schema.ts — defines the documents table in TypeScript:
// prettier-ignore
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),          // Clerk organization id — the tenant wall
    // Which file this chunk came from (lets queries filter by ticked documents).
    fileId: uuid("file_id").references(() => documentFiles.id, { onDelete: "cascade" }), // The id of the document_files row this chunk came from
    // null = firm-wide law book; set = case document (team only).
    matterId: uuid("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    source: text("source").notNull(),          // original filename
    chunkIndex: integer("chunk_index").notNull(),
    startChar: integer("start_char"),   // where this chunk begins in document_files.full_text
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(), // Voyage voyage-4
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("documents_org_id_idx").on(t.orgId),
    index("documents_file_id_idx").on(t.fileId),
    index("documents_matter_id_idx").on(t.matterId),
    index("documents_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ]
);
// prettier-ignore
export const documentFiles = pgTable(
  'document_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    // null = firm-wide law book; set = case document (team only).
    matterId: uuid('matter_id').references(() => matters.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by'), // Clerk userId (null for older uploads)
    source: text('source').notNull(),
    fullText: text('full_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('document_files_org_id_idx').on(t.orgId),
    index('document_files_matter_id_idx').on(t.matterId),
  ],
)

// ===== added on 16th Sept 2026 ===========

// A client belongs to a firm (org). One firm has many clients.
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(), // which firm owns this client
    name: text('name').notNull(), // "Mr Johnson", "Acme Corp"
    createdBy: text('created_by').notNull(), // the userId who onboarded them
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('clients_org_id_idx').on(t.orgId)],
)

// A matter (case) belongs to a client. One client can have many matters.
// prettier-ignore
export const matters = pgTable(
  'matters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }), // links to a client
    reference: text('reference'),           // optional, e.g. "MAT-2026-001" (nullable)
    title: text('title').notNull(),         // "Johnson vs Smith – boundary dispute 2026"
    status: text('status').notNull().default('open'), // open | closed | archived
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('matters_org_id_idx').on(t.orgId),
    index('matters_client_id_idx').on(t.clientId),
  ],
)

// The case team: who can access a matter, and their role on it.
// prettier-ignore
export const matterMembers = pgTable(
  'matter_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id')
      .notNull()
      .references(() => matters.id, { onDelete: 'cascade' }), // links to a matter
    userId: text('user_id').notNull(),      // the Clerk userId of the team member
    role: text('role').notNull().default('member'), // admin | member
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('matter_members_matter_id_idx').on(t.matterId),
    index('matter_members_user_id_idx').on(t.userId),
    uniqueIndex('matter_members_matter_user_uq').on(t.matterId, t.userId),
  ],
)

// Audit log: an immutable record of who did what, when — for compliance
// and so a case lead can see who accessed/queried a matter's documents.
// prettie-ignore
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: text('org_id').notNull(), // which firm (layer-1 scope)
    matterId: uuid('matter_id'), // which case (nullable: some actions aren't matter-specific)
    userId: text('user_id').notNull(), // WHO did it (Clerk userId)
    userName: text('user_name'), // their name at the time (snapshot — see note)
    action: text('action').notNull(), // WHAT they did (e.g. 'document.view', 'query.ask')
    targetType: text('target_type'), // what kind of thing (e.g. 'document', 'matter', 'member')
    targetId: text('target_id'), // the id of the thing acted on
    detail: text('detail'), // extra context (e.g. the question asked, the doc name)
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('audit_logs_org_id_idx').on(t.orgId),
    index('audit_logs_matter_id_idx').on(t.matterId),
    index('audit_logs_user_id_idx').on(t.userId),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
)
