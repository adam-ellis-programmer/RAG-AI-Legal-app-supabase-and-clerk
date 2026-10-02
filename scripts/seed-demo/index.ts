// scripts/seed-demo/index.ts
// Builds the demo firm. Safe to re-run: every stage finds what exists first.
// Run: npx tsx --env-file=.env.local scripts/seed-demo/index.ts
import { checkEnv, clerk, FIRM_NAME, ORG_ID } from './config'
import { seedPeople } from './people'

async function main() {
  checkEnv()
  await clerk.organizations.updateOrganization(ORG_ID, { name: FIRM_NAME })
  console.log(`Seeding ${FIRM_NAME} (${ORG_ID})`)

  const people = await seedPeople()
  console.table(people)

  // Later stages slot in here, each receiving what the earlier ones returned:
  // const library = await seedLibrary(people)
  // const cases = await seedCases(people, library)
  // ...
}

// process.exit because the database pool (used from stage 2)
// would otherwise keep the script running after it finishes.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })