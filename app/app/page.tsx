// app/app/page.tsx
// Server wrapper: checks the firm on the server, then hands the interactive
// library page a single yes/no. The client component can't call auth() itself.
import { auth } from '@clerk/nextjs/server'
import { isDemoOrg } from '@/lib/demo'
import FirmLibrary from '@/components/FirmLibrary'

export default async function AssistantPage() {
  const { orgId } = await auth() // <--  page made server so we can use this await auth()
  return <FirmLibrary readOnly={isDemoOrg(orgId)} />
}
