// app/demo/start/route.ts
// "Try the demo": mints a one-time sign-in token for the shared demo account
// and hands it to /demo, which signs the visitor in. No password is ever exposed.
import { clerkClient } from '@clerk/nextjs/server'
import { DEMO_ORG_ID } from '@/lib/demo'

export async function POST(req: Request) {
  const userId = process.env.DEMO_USER_ID
  if (!userId || !DEMO_ORG_ID) {
    return Response.json({ error: 'The demo is not configured.' }, { status: 503 })
  }

  const clerk = await clerkClient()

  // A previous visitor could have left the demo firm from the browser console.
  // Re-add the membership before every sign-in, so the demo always works.
  try {
    await clerk.organizations.createOrganizationMembership({
      organizationId: DEMO_ORG_ID,
      userId,
      role: 'org:member',
    })
  } catch {
    // Already a member: the normal case.
  }

  // Short-lived: it only needs to survive one redirect.
  const { token } = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 60,
  })

  // 303 tells the browser to follow the redirect with a GET.
  return Response.redirect(new URL(`/demo?token=${encodeURIComponent(token)}`, req.url), 303)
}