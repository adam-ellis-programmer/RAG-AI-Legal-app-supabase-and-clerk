'use server'
// Server actions for the firm's plan: starting a Stripe checkout.
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe'
import { getOrgPlanDetails, PLANS } from '@/lib/plan'
import { assertNotDemo } from '@/lib/demo'

export async function startCheckout() {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')
  await assertNotDemo()

  // Only firm admins can spend the firm's money. Checked here on the server:
  // hiding the button alone would protect nothing.
  if (orgRole !== 'org:admin')
    throw new Error('Only firm admins can change the plan')

  // Already on Pro (paid or comped)? Nothing to buy.
  const current = await getOrgPlanDetails(orgId)
  if (current.plan === 'pro') redirect('/app/plan')

  const appUrl = process.env.APP_URL
  const priceId = process.env.STRIPE_PRO_PRICE_ID
  if (!appUrl || !priceId) throw new Error('Stripe is not configured')

  const user = await currentUser()

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: PLANS.pro.includedSeats }],

    // Which firm is paying. The webhook (step 4) reads these to know
    // whose org_plans row to write.
    client_reference_id: orgId,
    metadata: { orgId },
    subscription_data: { metadata: { orgId } },

    // Reuse the firm's Stripe customer if they've paid before, otherwise
    // pre-fill the admin's email so Stripe creates a customer for them.
    ...(current.stripeCustomerId
      ? { customer: current.stripeCustomerId }
      : { customer_email: user?.primaryEmailAddress?.emailAddress }),

    allow_promotion_codes: true, // shows the "Add promotion code" box
    payment_method_collection: 'if_required', // a 100%-off code needs no card
    adaptive_pricing: { enabled: false }, // always charge in the price's own currency (GBP)

    success_url: `${appUrl}/app/plan?checkout=success`,
    cancel_url: `${appUrl}/app/plan?checkout=cancelled`,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout page')
  redirect(session.url)
}

/**
 
  * -> quantity: PLANS.pro.includedSeats (10): the firm starts with 10 seats. With your graduated price, 1–10 all cost £49.99, so they might as well have all ten.
  * -> Three places hold the orgId. Stripe sends your webhook different event types: checkout.session.completed carries the session’s client_reference_id and metadata, while later events like customer.subscription.updated (seat changes, cancellations) only carry the subscription’s metadata. Putting the orgId on both means every future event can say which firm it’s about.
  
  * -> customer vs customer_email: Stripe allows one or the other, not both. The ...( ? : ) spread picks whichever applies.
  
  * -> redirect(session.url) sends the admin’s browser to Stripe’s hosted payment page. That’s an address on checkout.stripe.com, outside your app, which redirect handles fine.
  * -> redirect isn’t in a try/catch on purpose. It works by throwing a special signal that Next.js catches, so a catch around it would swallow the redirect.
  * -> The role check uses orgRole from Clerk: 'org:admin' is Clerk’s built-in admin role for an organisation, the same one that controls who can invite members.
 */
