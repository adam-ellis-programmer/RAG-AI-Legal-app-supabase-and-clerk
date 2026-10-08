// scripts/seed-demo/people.ts
// Stage 1: the visitor account plus three colleagues, all in the demo firm.
// Colleagues never sign in; they exist so team lists and activity show real names.
import { clerk, ORG_ID } from './config'

// The visitor goes LAST so the firm already has an admin before
// the visitor is set to an ordinary member.
export const PEOPLE = [
  {
    key: 'eleanor',
    email: 'eleanor.wakefield@example.com',
    firstName: 'Eleanor',
    lastName: 'Wakefield',
    orgRole: 'org:admin',
  },
  {
    key: 'daniel',
    email: 'daniel.croft@example.com',
    firstName: 'Daniel',
    lastName: 'Croft',
    orgRole: 'org:member',
  },
  {
    key: 'priya',
    email: 'priya.shah@example.com',
    firstName: 'Priya',
    lastName: 'Shah',
    orgRole: 'org:member',
  },
  {
    key: 'visitor',
    email: 'demo-user@demo-user.com',
    firstName: 'Demo',
    lastName: 'Visitor',
    orgRole: 'org:member',
  },
] as const

export type PersonKey = (typeof PEOPLE)[number]['key'] // 'eleanor' | 'daniel' | 'priya' | 'visitor'
export type People = Record<PersonKey, string> // key → Clerk userId

async function ensureUser(p: (typeof PEOPLE)[number]) {
  // Find by email; create if missing (no password, so colleagues can't sign in).
  const { data } = await clerk.users.getUserList({ emailAddress: [p.email] })
  let id = data[0]?.id
  if (!id) {
    const created = await clerk.users.createUser({
      emailAddress: [p.email],
      firstName: p.firstName,
      lastName: p.lastName,
      skipPasswordRequirement: true,
    })
    id = created.id
  }
  // Always re-set the name and block creating organisations,
  // which also undoes anything a visitor changed.
  await clerk.users.updateUser(id, {
    firstName: p.firstName,
    lastName: p.lastName,
    createOrganizationEnabled: false,
  })
  return id
}

export async function seedPeople(): Promise<People> {
  // ------ fetched before the loop runs -------------------
  const { data: memberships } =
    await clerk.organizations.getOrganizationMembershipList({
      organizationId: ORG_ID,
      limit: 100,
    })

  const people = {} as People
  // ----- LOOP STARTS HERE ------------------------------
  for (const p of PEOPLE) {
    const userId = await ensureUser(p)
    // prettier-ignore
    // loop runs once for each iteration of people
    const existing = memberships.find((m) => m.publicUserData?.userId === userId)

    if (!existing) {
      // create
      await clerk.organizations.createOrganizationMembership({
        organizationId: ORG_ID,
        userId,
        role: p.orgRole,
      })
      // update
    } else if (existing.role !== p.orgRole) {
      await clerk.organizations.updateOrganizationMembership({
        organizationId: ORG_ID,
        userId,
        role: p.orgRole,
      })
    }
    people[p.key] = userId
  }

  return people
}
