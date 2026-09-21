// app/api/matters/[id]/query/route.ts
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { VoyageAIClient } from 'voyageai'
import { db } from '@/lib/db'
import { documentFiles, queries, type QuerySource } from '@/lib/schema'
import { getMatterAccess, isUuid } from '@/lib/matter-access'
import { logAction } from '@/lib/audit'
import { pageForChar } from '@/lib/pagination'
export const runtime = 'nodejs'
export const maxDuration = 60

const PER_DOC_K = 4 // best chunks taken from EACH ticked document
const MAX_CHUNKS = 12 // total chunks sent to Claude
const MAX_FILES = 20 // most documents that can be ticked at once
const MIN_SIMILARITY = 0.3 // ignore chunks less relevant than this

/**
       Why 0.3? Your real matches scored between 0.45 and 0.60. The irrelevant handbook chunks in the last test scored 0.10 to 0.21. A floor of 0.3 sits between those, so the "handbook only, case code?" question now sends no chunks at all.
       Keep an eye on it, though. Scores depend on the model and how a question is phrased. If a good question ever returns "couldn't find it", lower the floor to 0.25. It's one constant, so it's easy to tune.
 */

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

type Row = {
  content: string
  source: string
  chunk_index: number
  start_char: number | null
  file_id: string
  matter_id: string | null
  similarity: number
  rn: number
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: matterId } = await params

    // LAYERS 1 + 2: signed in, case is in this firm, user is on the case team.
    const access = await getMatterAccess(matterId)
    if (!access) {
      return Response.json({ error: 'Case not found.' }, { status: 404 })
    }
    const { userId, orgId, matter } = access

    // ---- Validate the request ----
    const body = await req.json().catch(() => null)
    const question =
      typeof body?.question === 'string' ? body.question.trim() : ''
    const rawIds: unknown = body?.fileIds

    if (!question) {
      return Response.json({ error: 'Enter a question.' }, { status: 400 })
    }
    if (question.length > 2000) {
      return Response.json({ error: 'Question is too long.' }, { status: 400 })
    }
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return Response.json(
        { error: 'Tick at least one document.' },
        { status: 400 },
      )
    }
    if (rawIds.some((v) => typeof v !== 'string' || !isUuid(v))) {
      return Response.json(
        { error: 'Invalid document selection.' },
        { status: 400 },
      )
    }
    const fileIds = [...new Set(rawIds as string[])]
    if (fileIds.length > MAX_FILES) {
      return Response.json(
        { error: `Tick at most ${MAX_FILES} documents.` },
        { status: 400 },
      )
    }

    // ---- Never trust ticked ids from the browser: re-check every one ----
    // Each must be in this firm AND be either a law book (matter_id null)
    // or a document on THIS case. A file from another case fails here.
    const allowed = await db
      .select({ id: documentFiles.id })
      .from(documentFiles)
      .where(
        and(
          eq(documentFiles.orgId, orgId),
          inArray(documentFiles.id, fileIds),
          or(
            isNull(documentFiles.matterId),
            eq(documentFiles.matterId, matterId),
          ),
        ),
      )
    if (allowed.length !== fileIds.length) {
      return Response.json(
        { error: 'One or more documents were not found.' },
        { status: 404 },
      )
    }

    // ---- 1. Embed the question (same model as ingestion) ----
    const res = await voyage.embed({
      input: question,
      model: 'voyage-4',
      inputType: 'query',
    })
    const queryEmbedding = res.data?.[0]?.embedding
    if (!queryEmbedding) {
      return Response.json(
        { error: 'Failed to embed the question.' },
        { status: 500 },
      )
    }
    const vectorLiteral = `[${queryEmbedding.join(',')}]`

    // ---- 2. Scoped similarity search, with a per-document quota ----
    // row_number() ranks chunks WITHIN each file, so a long law book can't
    // crowd out a short case letter. Ordering by rn first takes every ticked
    // document's best chunk before anyone's second-best.
    const idList = sql.join(
      fileIds.map((fid) => sql`${fid}::uuid`),
      sql`, `,
    )

    // Floor: chunks less relevant than MIN_SIMILARITY are dropped (keep an eye on this).
    const result = await db.execute(sql`
      select content, source, chunk_index, start_char, file_id, matter_id, similarity, rn
      from (
        select content, source, chunk_index, start_char, file_id, matter_id,
               1 - (embedding <=> ${vectorLiteral}::vector) as similarity,
               row_number() over (
                 partition by file_id
                 order by embedding <=> ${vectorLiteral}::vector
               ) as rn
        from documents
        where org_id = ${orgId}
          and file_id in (${idList})
          and (matter_id is null or matter_id = ${matterId})
      ) ranked
      where rn <= ${PER_DOC_K}
        and similarity >= ${MIN_SIMILARITY}
      order by rn, similarity desc
      limit ${MAX_CHUNKS}
    `)

    // Best matches first for the [1], [2] labels.
    const rows = (result.rows as Row[]).sort(
      (a, b) => Number(b.similarity) - Number(a.similarity),
    )

    // ---- 3. Build labelled context: case documents vs law books ----
    const context = rows
      .map((r, i) => {
        const kind = r.matter_id ? 'Case document' : 'Law book'
        return `[${i + 1}] (${kind}: ${r.source}, chunk ${r.chunk_index})\n${r.content}`
      })
      .join('\n\n')

    const system = rows.length
      ? `You are a legal research assistant supporting the case team on the matter "${matter.title}". ` +
        `The numbered context contains two kinds of source:\n` +
        `- "Case document": the client's files for this matter (facts, correspondence, allegations).\n` +
        `- "Law book": the firm's reference material (legal principles).\n\n` +
        `Rules:\n` +
        `- Answer using ONLY the context below. If it does not contain the answer, say so. Do not guess or use outside knowledge.\n` +
        `- Keep facts and law distinct: say what the case documents state, then what the law books say, then how the law applies to those facts.\n` +
        `- Treat statements in case documents, especially correspondence from the other side, as claims or allegations, not established facts.\n` +
        `- Cite every point inline like [1], [2], matching the numbered context.\n\n` +
        `Context:\n${context}`
      : `You are a legal research assistant. None of the ticked documents contained passages ` +
        `relevant to this question. Tell the user you could not find the answer in the ticked ` +
        `documents, and suggest they tick other documents or rephrase the question. Do not guess.`

    // Type the sources so they match what's stored. Change const sources = rows.map(...) to.
    const sources: QuerySource[] = rows.map((r, i) => ({
      n: i + 1,
      fileId: r.file_id,
      source: r.source,
      kind: r.matter_id ? 'case' : 'law',
      chunkIndex: r.chunk_index,
      page: pageForChar(r.start_char),
      startChar: r.start_char,
      similarity: Number(Number(r.similarity).toFixed(3)),
    }))

    // ---- 4. Save the question first, so it exists even if streaming fails ----
    const [saved] = await db
      .insert(queries)
      .values({ orgId, matterId, userId, question, fileIds, sources })
      .returning({ id: queries.id })

    // ----  Audit: who asked what, on which case ----
    await logAction({
      orgId,
      userId,
      matterId,
      action: 'query.ask',
      targetType: 'query',
      targetId: saved.id,
      detail: question.slice(0, 1000),
    })

    // ---- 5. Stream the answer, sources in a header (same pattern as /api/chat) ----
    // ---- 4. Save the question first, so it exists even if streaming fails ----

    await logAction({
      orgId,
      userId,
      matterId,
      action: 'query.ask',
      targetType: 'query',
      targetId: saved.id,
      detail: question.slice(0, 1000),
    })

    /**
     * How the saving works: 
     * the row is inserted before streaming with status = 'streaming' and an empty answer. When Claude finishes, onFinish receives the whole text and fills it in. So a crash mid-answer leaves an honest record ("streaming" or "error"), not a missing one. The query ID also goes back in a header, so the page can link to it straight away.
     */

    // ---- 5. Stream the answer; store it once it's complete ----
    const stream = streamText({
      model: anthropic('claude-sonnet-5'),
      system,
      prompt: question,
      onFinish: async ({ text }) => {
        // NEW: when the last word has been generated, save the whole answer.
        // Runs on the server after the last token, with the full text.
        try {
          await db
            .update(queries)
            .set({ answer: text, status: 'complete' })
            .where(eq(queries.id, saved.id))
        } catch (err) {
          console.error('saving answer failed:', err)
        }
      },
      onError: async () => {
        // NEW: if generation fails part-way, record that instead.
        try {
          await db
            .update(queries)
            .set({ status: 'error' })
            .where(eq(queries.id, saved.id))
        } catch (err) {
          console.error('marking query failed:', err)
        }
      },
    })

    return new Response(stream.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Sources': encodeURIComponent(JSON.stringify(sources)),
        'X-Query-Id': saved.id,
      },
    })
  } catch (err) {
    console.error('case query error:', err)
    return Response.json(
      { error: 'Query failed. Check server logs.' },
      { status: 500 },
    )
  }
}
