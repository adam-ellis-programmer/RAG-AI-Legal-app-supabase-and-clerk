// app/api/chat/route.ts
import { auth } from '@clerk/nextjs/server'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { sql } from 'drizzle-orm'
import { VoyageAIClient } from 'voyageai'
import { db } from '@/lib/db'
import { pageForChar } from '@/lib/pagination'
/**
 * quick notes
 * -- chunk_index is a permanent property of the chunk, set at ingestion time & answers "where in the source document did this come from?"
 * -- The [1], [2] in the context are freshly assigned citation labels, created at query time, based on retrieval rank, not document position. Your map((r, i) => ...) walks the retrieved rows — which are already sorted by similarity — and labels them 1, 2, 3 in that ranked order. -- So [1] means "the most relevant chunk for this question," [2] means "second most relevant,"
 * -- Why the citation is [1] even when the chunks "flipped" --- This follows from the above. The [1] in Claude's answer refers to the context label, not chunk_index. When the ranking flipped, the definitions chunk became the top-ranked chunk, so it got labelled [1] in the context. Claude used it for the answer, so it cited [1].
 * -- The citation always points at the context label of whichever chunk was used
 * -- The citation number is not tied to the chunk's identity — it's tied to the chunk's position in this query's ranked context. Same chunk can be [1] in one query and [2] in another.
 * --
 * -- Why i + 1? Because i (the array index) starts at 0, but humans — and citations — read naturally starting at 1. Nobody writes "see source [0]." So i + 1 converts the 0-based array index into a 1-based label: index 0 → [1], index 1 → [2]. It's purely cosmetic, to make the labels read naturally. If you used just [${i}] you'd get [0], [1], which works mechanically but looks odd and Claude would cite [0], which reads strangely.
 */

/**
    ************** formatting notes **************
    you format it precisely so you can inject it into the system prompt in a structured, labelled way. Three specific reasons the formatting earns its place:

    The [1], [2] labels give Claude something to cite. Without numbered labels, Claude has no way to say "this came from source X" — there'd be nothing to point at. The labels are what make citations possible at all. Raw concatenated text has no reference handles.

    The (source) tags tell Claude (and the reader) which document each chunk came from, so citations can map back to real files — essential when you have many documents.

    The \n\n separators keep chunks visually distinct so Claude can tell where one chunk ends and the next begins, rather than seeing one undifferentiated wall of text where two unrelated passages blur together.

    If you just gave Claude the raw chunk text with no structure, it would still read fine, but you'd lose citations entirely and Claude couldn't distinguish or attribute sources. The formatting is what turns "here's some text" into "here are 2 labelled, attributed sources you can cite." So your instinct is exactly right: it's formatted this way to be injected into the system prompt as structured, citable context.
 */

// pg needs the Node runtime, not Edge. (??)
export const runtime = 'nodejs'

// Same placeholder tenant as ingestion, until Clerk is wired in.
// const DEV_ORG_ID = 'dev-placeholder-org'
const TOP_K = 5 // how many chunks to retrieve as context

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

// data pipe line and HOW IS STREAM WORKING (NO ASYNC)
// prettier-ignore
export async function POST(req: Request) {
  try {

    const { userId, orgId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (!orgId) return Response.json({ error: 'No active organization selected.' }, { status: 400 })
    const { question } = await req.json()

    if (!question || typeof question !== 'string' || !question.trim()) {
      return Response.json({ error: 'Provide a `question` string.' },{ status: 400 })
    }

    // 1. Embed the QUESTION. Note inputType "query" — documents were embedded
    //    with "document". Same model (voyage-4) so the vectors are comparable.
    const res = await voyage.embed({
      input: question,
      model: 'voyage-4',
      inputType: 'query',
    })

    console.log('res.data', res.data)
    console.log('------------')

    const queryEmbedding = res.data?.[0]?.embedding
    console.log('query embedding: ', queryEmbedding)

    if (!queryEmbedding) {
      return Response.json(
        { error: 'Failed to embed the question.' },
        { status: 500 },
      )
    }

    // 2. Similarity search: order rows by cosine distance (<=>) to the question,
    //    closest first, and take the top K. (1 - distance) = a 0..1 similarity score.
    const vectorLiteral = `[${queryEmbedding.join(',')}]`

    console.log('vector literal: ', vectorLiteral)

    /**
     * ~~~~~~~~~~~~~~~~~~~~
     * Voyage creates the embeddings (the vectors). It does not do the cosine comparison.
     * pgvector (inside Postgres) does the cosine math — that's what the <=> operator is.
     * Your database runs the cosine calculation, not Voyage.
     * 
     * So neither you nor Voyage does the cosine arithmetic by hand — but it's 
     * pgvector/Postgres doing it, not Voyage. Voyage's job ends once the vectors exist; 
     * the comparing is the database's job. Keep those two separate: Voyage makes vectors, 
     * pgvector compares them.
     * 
     * Chunking (splitting the document into pieces) is done by your code, not Voyage — that's your chunkText function.
     * Embedding (turning each chunk into a vector) is Voyage's job.
     * cosine only shows up later, at query time,
     * 
     * 1. Upload → Voyage → embeddings. ✅ Correct, but one wording fix: "voyage has its own algorithm that converts it to cosine chunks." There's no such thing as "cosine chunks." Two separate things got blended:
     * 
     * 2 Query → Voyage → query embedding, using the same model. ✅ Completely correct. You even nailed the crucial detail — the same algorithm/model — which is what makes the vectors comparable. This is spot on.
     * 
     * 3. Pass the query embedding to the SQL query, <=> compares it against every stored chunk and scores them, highest similarity wins. ✅
     * 
     * it's pgvector (the database extension) doing the <=> cosine comparison, not Voyage.
     * 
     * 4 Select the top 5 chunks → hand to the AI (Anthropic/Claude) with the question → get an answer. ✅
     * 
     * 
     * 
     * So here's your flow, cleaned up and in the right order:

        -  Upload: your code splits the document into chunks (chunkText), then Voyage turns each chunk into an embedding vector, and you store those vectors in the database. (No cosine yet — just creating and storing vectors.)
        -  Query: you take the question string and run it through Voyage using the same model, producing a query embedding that's comparable to the stored ones.
        -  Search: you pass that query embedding into the SQL query, and pgvector's <=> operator computes the cosine comparison between the query vector and every stored chunk vector, scoring each by similarity.
        -  Rank & limit: the query sorts by that score and takes the top 5 (TOP_K) closest chunks.
        -  Answer: those 5 chunks plus the question go to Claude (Anthropic), which reads the chunks as context and generates the grounded answer.


        The three corrections in one sentence each, so they stick:

          - Chunking is your code's job, not Voyage's — Voyage only embeds.
          - Cosine happens at query time, not at upload — uploading just creates and stores vectors; nothing is compared until a question comes in.
          - The cosine comparison is done by pgvector (the database), not Voyage — Voyage makes vectors, the database compares them with <=>.
     * ~~~~~~~~~~~~~~~~~~~~
     */

      const result = await db.execute(sql`
      select content, source, chunk_index, file_id, start_char,
             1 - (embedding <=> ${vectorLiteral}::vector) as similarity
      from documents
      where org_id = ${orgId}
        and matter_id is null
      order by embedding <=> ${vectorLiteral}::vector
      limit ${TOP_K}
    `)

    console.log('main result: ', result)

    const rows = result.rows as Array<{
      content: string
      source: string
      chunk_index: number
      file_id: string | null
      start_char: number | null
      similarity: number
    }>

    // console.log('rows: ', rows)
    // console.log('--------------')

    // 3. Build a numbered context block so Claude can cite its sources.
    const context = rows
      .map((r, i) => `[${i + 1}] (${r.source})\n${r.content}`)
      .join('\n\n')

    // console.log('context: ', context)

    const system = rows.length
      ? `You are a helpful assistant answering questions about legal documents. ` +
        `Answer using ONLY the context below. If the answer is not in the context, ` +
        `say you don't have that information — do not guess. ` +
        `Cite sources inline like [1], [2], matching the numbered context.\n\n` +
        `Context:\n${context}`
      : `You are a helpful assistant. The knowledge base returned no relevant context ` +
        `for this question. Tell the user you don't have information on that topic ` +
        `rather than guessing.`

    // console.log('system: ', system)

    // Build a compact source list for the UI. Order matches the [1], [2] labels.
    const sources = rows.map((r, i) => ({
      n: i + 1,
      fileId: r.file_id,
      source: r.source,
      chunkIndex: r.chunk_index,
      page: pageForChar(r.start_char),
      startChar: r.start_char,
      similarity: Number(r.similarity.toFixed(3)),
    }))

    // 4. Stream Claude's grounded answer back as plain text.
    // TEST A VANILLA STREAM APP SO IT STREAMS FROM A FILE TO THE DOM
    const stream = streamText({
      model: anthropic('claude-sonnet-5'),
      system,
      prompt: question,
    })

    // console.log('stream: ', stream)

    // Wrap the raw text stream in our own Response so we can add the header
    // without the deprecated toTextStreamResponse(init) call.

    return new Response(stream.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // headers can't contain raw {, ", and so on reliably, so encoding turns them into
        // plain-ASCII %-codes.
        // Then your frontend reverses it:
        // sources = JSON.parse(decodeURIComponent(raw))
        // decodeURIComponent(raw) turns the %-codes back into real characters → the JSON string.
        // fetch's await resolves when headers arrive (not when the body finishes)
        'X-Sources': encodeURIComponent(JSON.stringify(sources)),
      },
    })

    // return stream.toTextStreamResponse()
  } catch (err) {
    console.error('chat error:', err)
    return Response.json(
      { error: 'Query failed. Check server logs.' },
      { status: 500 },
    )
  }
}
