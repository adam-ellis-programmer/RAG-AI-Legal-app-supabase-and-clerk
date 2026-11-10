// scripts/seed-demo/chat.ts
// Stage 7: example firm chat. Chat is read-only in the demo firm
// (postingBlockedReason), so these messages are what every visitor sees.
// They show the rules: case chats follow the case team, the ethical wall
// covers chat (party wall), and DMs are private (Daniel ↔ Priya).
import { db } from '@/lib/db'
import { chatConversations, chatMembers, chatMessages, chatReads } from '@/lib/schema'
import { dmKeyFor } from '@/lib/chat-access'
import { ORG_ID, daysAgo } from './config'
import type { People, PersonKey } from './people'
import type { Cases } from './cases'

/** n days ago at a set time, so messages have realistic times of day. */
function at(days: number, hour: number, minute = 0) {
  const d = daysAgo(days, hour)
  d.setMinutes(minute)
  return d
}

type Msg = { from: PersonKey; at: Date; body: string }

// visitorHasRead = how many of the messages the visitor has already read.
// The rest show as unread, so the badges have something to show.
type ChatSpec =
  | { kind: 'case'; case: keyof Cases; visitorHasRead: number; messages: Msg[] }
  | { kind: 'direct'; between: [PersonKey, PersonKey]; visitorHasRead: number; messages: Msg[] }

// Every message is dated after its case was created (boundary 45 days ago,
// right of way 38, party wall 26) and after the document it mentions.
// prettier-ignore
const CHATS: ChatSpec[] = [
  {
    kind: 'case', case: 'boundary', visitorHasRead: 6,
    messages: [
      { from: 'eleanor', at: at(40, 9, 12),  body: "Ashworth Lane's letter is in and uploaded to the case. They want a response within 21 days." },
      { from: 'priya',   at: at(40, 9, 40),  body: "Thanks. I'll take Mr Hartley's statement this week." },
      { from: 'priya',   at: at(35, 16, 5),  body: 'Statement uploaded. He has old photos of the fence too, which I have asked him to send over.' },
      { from: 'eleanor', at: at(35, 16, 20), body: "Good. Let's get a surveyor's view before we reply. Marsh & Holt if they're free." },
      { from: 'priya',   at: at(23, 11, 30), body: 'Marsh & Holt report is in and uploaded.' },
      { from: 'eleanor', at: at(23, 11, 48), body: "Excellent. Draft a holding reply to Ashworth Lane and I'll review it tomorrow." },
      { from: 'eleanor', at: at(2, 14, 10),  body: 'Ashworth Lane have asked for a without-prejudice meeting. Can we pull the key points from the survey before Thursday?' },
      { from: 'priya',   at: at(2, 14, 22),  body: "On it. I'll ask Citewise for a summary and check it against the report." },
    ],
  },
  {
    kind: 'case', case: 'rightOfWay', visitorHasRead: 5,
    messages: [
      { from: 'daniel', at: at(36, 10, 2),  body: 'The 1998 transfer extract is uploaded. The right of way wording is the key part.' },
      { from: 'priya',  at: at(30, 15, 15), body: "Thomas Reed's witness statement is uploaded. As farm manager he can speak to how the track is actually used." },
      { from: 'daniel', at: at(30, 15, 31), body: 'Good. The keypad gate is the real issue, so that is where we focus.' },
      { from: 'daniel', at: at(6, 9, 45),   body: 'Client asks whether giving the neighbours the gate code would be enough. Priya, can you check the transfer?' },
      { from: 'priya',  at: at(6, 10, 20),  body: "Will do. I'll draft a short note for you this afternoon." },
    ],
  },
  {
    // Behind the ethical wall: the visitor isn't on this team, so never sees it.
    kind: 'case', case: 'partyWall', visitorHasRead: 0,
    messages: [
      { from: 'daniel', at: at(24, 13, 0),  body: 'Party wall notice uploaded. Reminder: this matter is walled off, so keep it within the two of us.' },
      { from: 'priya',  at: at(24, 13, 12), body: 'Understood.' },
    ],
  },
  {
    kind: 'direct', between: ['eleanor', 'visitor'], visitorHasRead: 0,
    messages: [
      { from: 'eleanor', at: at(1, 17, 30), body: "Welcome to Wakefield & Croft! You're on the Hartley boundary and Brookfield right of way cases. Try asking Citewise a question on either one." },
      { from: 'eleanor', at: at(1, 17, 31), body: 'Chat is read-only in the demo, but everything else is yours to explore.' },
    ],
  },
  {
    // A private DM between two other people: the visitor can't see it.
    kind: 'direct', between: ['daniel', 'priya'], visitorHasRead: 0,
    messages: [
      { from: 'daniel', at: at(3, 12, 0), body: 'Lunch on Thursday to go through the Brookfield bundle?' },
      { from: 'priya',  at: at(3, 12, 4), body: 'Yes, 1pm works.' },
    ],
  },
]

export async function seedChat(people: People, cases: Cases) {
  let messageCount = 0

  for (const chat of CHATS) {
    const first = chat.messages[0].at

    // 1. The conversation itself
    const [conversation] = await db
      .insert(chatConversations)
      .values(
        chat.kind === 'case'
          ? { orgId: ORG_ID, type: 'case' as const, matterId: cases[chat.case].id, createdAt: first }
          : {
              orgId: ORG_ID,
              type: 'direct' as const,
              dmKey: dmKeyFor(people[chat.between[0]], people[chat.between[1]]),
              createdAt: first,
            },
      )
      .returning({ id: chatConversations.id })

    // 2. DM members (case chats get their members from the case team instead)
    if (chat.kind === 'direct') {
      await db
        .insert(chatMembers)
        .values(chat.between.map((p) => ({ conversationId: conversation.id, userId: people[p] })))
    }

    // 3. The messages
    await db.insert(chatMessages).values(
      chat.messages.map((m) => ({
        orgId: ORG_ID,
        conversationId: conversation.id,
        senderId: people[m.from],
        body: m.body,
        createdAt: m.at,
      })),
    )
    messageCount += chat.messages.length

    // 4. The visitor's read marker: read up to message N, so everything after it is unread
    if (chat.visitorHasRead > 0) {
      await db.insert(chatReads).values({
        conversationId: conversation.id,
        userId: people.visitor,
        lastReadAt: chat.messages[chat.visitorHasRead - 1].at,
      })
    }
  }

  console.log(`  ${CHATS.length} conversations, ${messageCount} messages`)
}