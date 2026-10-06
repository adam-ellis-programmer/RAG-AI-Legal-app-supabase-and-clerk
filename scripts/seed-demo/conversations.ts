// scripts/seed-demo/conversations.ts
// Stage 4: saved research conversations (a question plus a follow-up on two cases).
// The answers are written here so the demo is identical on every run, but every
// citation is resolved against the real stored chunks: real chunk, real page,
// real highlight, and a real similarity score for that question.
import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { VoyageAIClient } from 'voyageai'
import { db } from '@/lib/db'
import { documents, queries, type QuerySource } from '@/lib/schema'
import { pageForChar } from '@/lib/pagination'
import { ORG_ID, daysAgo } from './config'
import type { People, PersonKey } from './people'
import type { Library } from './library'
import type { Cases } from './cases'

type CaseKey = keyof Cases
// A cited document: 'law:<library key>' or 'case:<document key on this case>'.
type DocRef = `law:${keyof Library}` | `case:${string}`
type Cite = { doc: DocRef; phrase: string } // phrase = words that appear in the cited passage

type Turn = {
  askedBy: PersonKey
  daysAgo: number
  hour: number
  question: string
  searchQuery?: string // follow-ups: the standalone version used for scoring, as Haiku would rewrite it
  answer: string
  cites: Cite[]
}
type Conversation = { case: CaseKey; ticked: DocRef[]; turns: Turn[] }
// prettier-ignore
const CONVERSATIONS: Conversation[] = [
  {
    case: 'boundary',
    ticked: ['case:pembertonLetter', 'case:hartleyStatement', 'case:surveyorReport', 'law:boundaries'],
    turns: [
      {
        askedBy: 'priya',
        daysAgo: 18,
        hour: 11,
        question: 'Does Mr Pemberton have a valid adverse possession claim to the strip at the rear of the gardens?',
        cites: [
          { doc: 'law:boundaries', phrase: 'unbroken period of fourteen years' },
          { doc: 'case:pembertonLetter', phrase: 'took over the strip directly from her' },
          { doc: 'law:boundaries', phrase: 'their periods of possession may be added together' },
          { doc: 'case:hartleyStatement', phrase: 'On 3 May 2018 I wrote to Mrs Ellis' },
          { doc: 'law:boundaries', phrase: 'A single written objection is enough to break the period' },
          { doc: 'case:surveyorReport', phrase: 'a further 13 centimetres or so into number 14' },
          { doc: 'case:pembertonLetter', phrase: 'not aware of any objection ever having been made' },
        ],
        answer: `**Probably not, on the documents we hold.**

Under the firm's handbook, an occupier must show factual possession for an unbroken period of fourteen years [1]. Mr Pemberton relies on the fence his predecessor, Mrs Ellis, put up in spring 2011, and says he took over the strip directly from her when he bought number 12 in 2019 [2]. Successive owners' periods can be added together where each took over directly from the last [3], so on his case the clock would have run from 2011 to 2025.

The difficulty for him is Mr Hartley's letter of **3 May 2018**, in which he told Mrs Ellis that he did not accept the fence was on the boundary and objected to her use of the strip [4]. A single written objection breaks the period, and the fourteen years start again from the date of the objection [5]. Counting from May 2018, a fresh period could not complete before May 2032.

There is a second, independent point: the June 2026 fence stands roughly 13 centimetres further into number 14 than the 2011 fence did [6]. Even on Mr Pemberton's own case, nobody has possessed that extra land for more than a few months.

**To check:** we need the original 2018 letter and any evidence it was sent. Ashworth Lane say their client is not aware of any objection before August 2026 [7], so the letter is likely to be the key document in the dispute.`,
      },
      {
        askedBy: 'eleanor',
        daysAgo: 18,
        hour: 15,
        question: 'What should we put together before suggesting mediation?',
        cites: [
          { doc: 'case:surveyorReport', phrase: 'it stands 41 centimetres from the line of the original posts' },
          { doc: 'law:boundaries', phrase: 'instruct a single joint expert surveyor' },
          { doc: 'case:surveyorReport', phrase: 'Their positions match the line on the 1974 conveyance plan' },
          { doc: 'law:boundaries', phrase: 'obtain the title registers and title plans for both properties' },
          { doc: 'law:boundaries', phrase: 'Ask the client for dated photographs of the boundary' },
          { doc: 'case:hartleyStatement', phrase: 'I have photographs of the old posts taken in 2009 and 2018' },
          { doc: 'law:boundaries', phrase: "most settle within three months of a surveyor's report being shared" },
        ],
        answer: `Before proposing mediation I would assemble four things.

1. **A single joint expert.** The strip is 41 centimetres wide at the rear corner [1], over the 30 centimetre threshold at which the firm's practice is to propose a single joint expert surveyor [2]. The Marsh & Holt report is a strong starting point, because it ties the original concrete posts to the 1974 conveyance plan to within 5 centimetres [3].
2. **The title documents** for both numbers 12 and 14, together with the 1974 conveyance that first divided the land [4].
3. **Dated photographs**, especially of any older fence [5]. Mr Hartley has photographs of the old posts from 2009 and 2018, and of the 2011 fence [6].
4. **The 3 May 2018 letter**, with any evidence of posting, since it is what defeats the adverse possession claim.

It is worth sharing the surveyor's report early: in the firm's experience, most boundary disputes settle within three months of a report being shared [7].`,
      },
    ],
  },
  {
    case: 'rightOfWay',
    ticked: ['case:transfer', 'case:reedStatement', 'law:rightsOfWay'],
    turns: [
      {
        askedBy: 'daniel',
        daysAgo: 9,
        hour: 10,
        question: "Is the new keypad gate an obstruction of Brookfield's right of way?",
        cites: [
          { doc: 'case:transfer', phrase: 'for all purposes connected with the use of the Property as agricultural land' },
          { doc: 'case:transfer', phrase: 'provided that the gates are kept unlocked or that the Buyer is provided with the means of opening them at all times' },
          { doc: 'case:reedStatement', phrase: 'We have not been given the code' },
          { doc: 'case:reedStatement', phrase: 'On weekdays this usually takes between 20 and 40 minutes' },
          { doc: 'law:rightsOfWay', phrase: 'A gate fitted with a keypad is treated like a locked gate' },
          { doc: 'case:reedStatement', phrase: 'I wrote to the Ashcombe estate office on 12 March 2026' },
        ],
        answer: `**Yes, very likely.**

The 1998 transfer grants Brookfield a right of way at all times and for all purposes connected with the agricultural use of the farm [1]. Clause 10.1 allows Ashcombe to keep gates at G1 and G2, but only if they are kept unlocked or Brookfield is given the means of opening them at all times [2].

Since 4 March 2026 the gate at G2 has had a keypad, and Brookfield has not been given the code [3]. Staff must telephone the estate office and usually wait 20 to 40 minutes on weekdays, often with no answer at weekends [4]. The firm's guide treats a keypad gate like a locked gate unless the code has been given to everyone entitled to use the route [5]. On these facts the gate is both a breach of clause 10.1 and an obstruction of the right of way.

Mr Reed asked for the code in writing on 12 March and 15 June 2026 and received no reply [6], which helps show the interference is ongoing and unreasonable.`,
      },
      {
        askedBy: 'priya',
        daysAgo: 9,
        hour: 14,
        question: 'What about the stone planters, and what should our next step be?',
        cites: [
          { doc: 'case:reedStatement', phrase: 'I measured the gap between the planters and the opposite verge at 2.4 metres' },
          { doc: 'case:reedStatement', phrase: 'Our combine harvester is 3.1 metres wide' },
          { doc: 'case:transfer', phrase: 'having a width of 3.5 metres throughout' },
          { doc: 'case:transfer', phrase: 'shall not place or permit anything on the Track that prevents its use by agricultural vehicles' },
          { doc: 'law:rightsOfWay', phrase: 'the firm treats a width of less than 2.7 metres at any point as a likely obstruction' },
          { doc: 'law:rightsOfWay', phrase: 'giving the other side twenty-eight days to remove the obstruction' },
          { doc: 'law:rightsOfWay', phrase: 'The firm does not recommend self-help' },
        ],
        answer: `The planters are a second, separate obstruction. They leave a gap of 2.4 metres [1], and Brookfield's combine harvester is 3.1 metres wide [2]. The transfer plan shows the track at 3.5 metres throughout [3], and clause 10.2 forbids Ashcombe from placing anything on it that prevents its use by the farm's agricultural vehicles [4]. Even without that express clause, the firm's guide treats any width under 2.7 metres on a vehicular route as a likely obstruction [5].

**Next step:** a letter before action covering both the keypad gate and the planters, giving Ashcombe twenty-eight days to provide the code and remove the planters, and proposing mediation [6]. We should also advise Mr Reed in writing not to move the planters himself [7].`,
      },
    ],
  },
]

// --------------------------------------------------------------------------

let voyageClient: VoyageAIClient | null = null
// prettier-ignore
async function embedQuestion(text: string) {
  voyageClient ??= new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
  const res = await voyageClient.embed({ input: text, model: 'voyage-4', inputType: 'query' })
  const vector = res.data?.[0]?.embedding
  if (!vector) throw new Error(`Could not embed question: ${text}`)
  return `[${vector.join(',')}]`
}

/** Turn 'law:boundaries' or 'case:surveyorReport' into a stored document. */
// prettier-ignore
function resolveDoc(ref: DocRef, caseKey: CaseKey, library: Library, cases: Cases) {
  const [kind, key] = ref.split(':') as ['law' | 'case', string]
  const doc = kind === 'law' ? library[key as keyof Library] : cases[caseKey].docs[key]
  if (!doc) throw new Error(`Unknown document reference: ${ref}`)
  return { ...doc, kind }
}

/** Find the stored chunk containing the phrase, and score it against the question. */
// prettier-ignore
async function buildSource(n: number, cite: Cite, vector: string, caseKey: CaseKey, library: Library, cases: Cases): Promise<QuerySource> {
  const doc = resolveDoc(cite.doc, caseKey, library, cases)
  const [chunk] = await db
    .select({
      chunkIndex: documents.chunkIndex,
      startChar: documents.startChar,
      similarity: sql<number>`1 - (${documents.embedding} <=> ${vector}::vector)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.fileId, doc.id),
        // . It's used instead of LIKE '%...%' because % and _ have special meanings in LIKE, and position has none ??
        sql`position(lower(${cite.phrase}) in lower(${documents.content})) > 0`,
      ),
    )
    // : because chunks overlap by 150 characters, a phrase near a boundary can appear in two chunks. This always picks the first.??
    .orderBy(documents.chunkIndex)
    .limit(1)

  if (!chunk) {
    throw new Error(`Citation phrase not found in "${doc.source}": "${cite.phrase}"`)
  }
  return {
    n,
    fileId: doc.id,
    source: doc.source,
    kind: doc.kind,
    chunkIndex: chunk.chunkIndex,
    page: pageForChar(chunk.startChar),
    startChar: chunk.startChar,
    similarity: Number(Number(chunk.similarity).toFixed(3)),
  }
}

export type SavedQuery = {
  id: string
  matterId: string
  userId: string
  question: string
  createdAt: Date
  citedFileIds: string[]
}
// prettier-ignore
export async function seedConversations(people: People, library: Library, cases: Cases): Promise<SavedQuery[]> {
  const saved: SavedQuery[] = []

  for (const convo of CONVERSATIONS) {
    const matterId = cases[convo.case].id
    const ticked = convo.ticked.map((ref) => resolveDoc(ref, convo.case, library, cases).id)

    // threadId follows your query route's rule: the first question's ID doubles as the thread ID, and the follow-up carries the same threadId. That's what makes the case page show "Follow-up:" and the saved-answer page show the whole conversation.
    const threadId = randomUUID() // the first question's id doubles as the thread id

    for (const [i, turn] of convo.turns.entries()) {
      const id = i === 0 ? threadId : randomUUID()
      const vector = await embedQuestion(turn.question)

      const sources: QuerySource[] = []
      for (const [j, cite] of turn.cites.entries()) {
        sources.push(await buildSource(j + 1, cite, vector, convo.case, library, cases))
      }

      const createdAt = daysAgo(turn.daysAgo, turn.hour)
      await db.insert(queries).values({
        id,
        orgId: ORG_ID,
        matterId,
        threadId,
        userId: people[turn.askedBy],
        question: turn.question,
        answer: turn.answer,
        fileIds: ticked,
        sources,
        status: 'complete',
        createdAt,
      })

      saved.push({
        id,
        matterId,
        userId: people[turn.askedBy],
        question: turn.question,
        createdAt,
        citedFileIds: [...new Set(sources.map((s) => s.fileId))],
      })
    }
    console.log(`  conversation on ${cases[convo.case].title} (${convo.turns.length} turns)`)
  }
  return saved
}
