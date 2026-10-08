// scripts/seed-demo/cases.ts
// Stage 3: clients, cases, case teams and case documents.
// One case deliberately leaves the demo visitor off its team, to show the ethical wall.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { clients, matters, matterMembers } from '@/lib/schema'
import { storeDocument } from '@/lib/ingest'
import { ORG_ID, daysAgo } from './config'
import type { People, PersonKey } from './people'

const CASES_DIR = path.join(process.cwd(), 'scripts/seed-demo/docs/cases')

const CLIENTS = [
  {
    key: 'hartley',
    name: 'Mr and Mrs Hartley',
    createdBy: 'eleanor',
    daysAgo: 48,
  },
  {
    key: 'brookfield',
    name: 'Brookfield Farm Ltd',
    createdBy: 'daniel',
    daysAgo: 41,
  },
] as const

type ClientKey = (typeof CLIENTS)[number]['key']
type Role = 'admin' | 'member'

type CaseSpec = {
  key: string
  client: ClientKey
  title: string
  reference: string
  createdBy: PersonKey
  daysAgo: number
  team: { person: PersonKey; role: Role }[]
  docs: {
    key: string
    file: string
    source: string
    uploadedBy: PersonKey
    daysAgo: number
  }[]
}

export const CASES = [
  {
    key: 'boundary',
    client: 'hartley',
    title: 'Hartley v Pemberton – boundary fence',
    reference: 'MAT-2026-014',
    createdBy: 'eleanor',
    daysAgo: 45,
    team: [
      { person: 'eleanor', role: 'admin' },
      { person: 'visitor', role: 'admin' },
      { person: 'priya', role: 'member' },
    ],
    docs: [
      {
        key: 'pembertonLetter',
        file: 'boundary/pemberton-solicitors-letter.txt',
        source: 'Letter from Ashworth Lane Solicitors, 19 Aug 2026',
        uploadedBy: 'eleanor',
        daysAgo: 40,
      },
      {
        key: 'hartleyStatement',
        file: 'boundary/hartley-statement.txt',
        source: 'Client statement – Robert Hartley',
        uploadedBy: 'priya',
        daysAgo: 35,
      },
      {
        key: 'surveyorReport',
        file: 'boundary/surveyor-report.txt',
        source: 'Boundary survey report – Marsh & Holt',
        uploadedBy: 'priya',
        daysAgo: 23,
      },
    ],
  },
  {
    key: 'rightOfWay',
    client: 'brookfield',
    title: 'Brookfield Farm – right of way, keypad gate',
    reference: 'MAT-2026-009',
    createdBy: 'daniel',
    daysAgo: 38,
    team: [
      { person: 'daniel', role: 'admin' },
      { person: 'visitor', role: 'admin' },
      { person: 'priya', role: 'member' },
    ],
    docs: [
      {
        key: 'transfer',
        file: 'right-of-way/transfer-1998-extract.txt',
        source: 'Transfer of 14 Oct 1998 – extract',
        uploadedBy: 'daniel',
        daysAgo: 36,
      },
      {
        key: 'reedStatement',
        file: 'right-of-way/farm-manager-statement.txt',
        source: 'Witness statement – Thomas Reed',
        uploadedBy: 'daniel',
        daysAgo: 30,
      },
    ],
  },
  {
    // The ethical wall: the demo visitor is NOT on this team.
    key: 'partyWall',
    client: 'hartley',
    title: 'Hartley – party wall, 16 Orchard Lane',
    reference: 'MAT-2026-021',
    createdBy: 'daniel',
    daysAgo: 26,
    team: [
      { person: 'daniel', role: 'admin' },
      { person: 'priya', role: 'member' },
    ],
    docs: [
      {
        key: 'notice',
        file: 'party-wall/party-wall-notice.txt',
        source: 'Party wall notice, 1 Sep 2026',
        uploadedBy: 'daniel',
        daysAgo: 24,
      },
    ],
  },
] as const satisfies readonly CaseSpec[]

type CaseKey = (typeof CASES)[number]['key']
type StoredDoc = { id: string; source: string }
export type Cases = Record<
  CaseKey,
  {
    id: string
    title: string
    clientId: string
    docs: Record<string, StoredDoc>
  }
>

export async function seedCases(people: People): Promise<Cases> {
  // 1. Clients
  const clientIds = {} as Record<ClientKey, string>
  for (const c of CLIENTS) {
    const [row] = await db
      .insert(clients)
      .values({
        orgId: ORG_ID,
        name: c.name,
        createdBy: people[c.createdBy],
        createdAt: daysAgo(c.daysAgo),
      })
      .returning({ id: clients.id })
    clientIds[c.key] = row.id
  }

  // 2. Cases, their teams, and their documents
  const cases = {} as Cases
  for (const spec of CASES) {
    const [matter] = await db
      .insert(matters)
      .values({
        orgId: ORG_ID,
        clientId: clientIds[spec.client],
        title: spec.title,
        reference: spec.reference,
        createdBy: people[spec.createdBy],
        createdAt: daysAgo(spec.daysAgo),
      })
      .returning({ id: matters.id })

    await db.insert(matterMembers).values(
      spec.team.map((m) => ({
        matterId: matter.id,
        userId: people[m.person],
        role: m.role,
        addedAt: daysAgo(spec.daysAgo),
      })),
    )

    const docs: Record<string, StoredDoc> = {}
    // prettier-ignore
    for (const d of spec.docs) {
        const rawText = await readFile(path.join(CASES_DIR, d.file), 'utf8')
        const stored = await storeDocument({
            orgId: ORG_ID,
            matterId: matter.id, // set = case document, visible to this case's team only
            uploadedBy: people[d.uploadedBy],
            source: d.source,
            rawText,
            createdAt: daysAgo(d.daysAgo),
        })
        docs[d.key] = { id: stored.id, source: d.source }
    }

    // prettier-ignore
    cases[spec.key] = { id: matter.id, title: spec.title, clientId: clientIds[spec.client], docs }
    // prettier-ignore
    console.log(`  case: ${spec.title} (${spec.team.length} on team, ${spec.docs.length} documents)`)
  }
  return cases
}
