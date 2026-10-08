// app/demo/page.tsx
import { DEMO_ORG_ID } from '@/lib/demo'
import DemoSignIn from '@/components/DemoSignIn'

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <DemoSignIn token={token ?? null} orgId={DEMO_ORG_ID} />
}