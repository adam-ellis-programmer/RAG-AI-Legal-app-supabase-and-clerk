// scripts/seed-demo/index.ts
// Builds the demo firm from scratch. Safe to re-run.
//   npm run seed:demo        → clear the demo firm's rows, then seed
//   npm run seed:demo:clear  → clear only
import { checkEnv, clerk, FIRM_NAME, ORG_ID } from './config'
import { clearDemo } from './clear'
import { seedPeople } from './people'
import { seedLibrary } from './library'
import { seedCases } from './cases'
import { seedConversations } from './conversations'
import { seedActivity } from './activity'
const clearOnly = process.argv.includes('--clear')

// ******* STAGES ******* ????
async function main() {
  checkEnv()
  const org = await clerk.organizations.getOrganization({
    organizationId: ORG_ID,
  })
  console.log(`Demo firm: ${org.name} (${ORG_ID})`)

  // Always start from empty, so the result is the same every time.
  await clearDemo()
  if (clearOnly) return

  await clerk.organizations.updateOrganization(ORG_ID, { name: FIRM_NAME })

  console.log('Stage 1: People')
  const people = await seedPeople()
  console.table(people)

  console.log('Stage 2: library')
  const library = await seedLibrary(people)

  console.log('Stage 3: cases')
  const cases = await seedCases(people)

  console.log('Stage 4: conversations')
  const convos = await seedConversations(people, library, cases)

  console.log('Stage 5: activity')
  await seedActivity(people, cases, convos)

  // Later stages slot in here:
  // const library = await seedLibrary(people)
  // const cases = await seedCases(people, library)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
