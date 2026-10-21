'use server'
// Server actions for the firm's plan: starting a Stripe checkout.
import Stripe from 'stripe' // for recognising a declined card
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { syncSubscription } from '@/lib/billing'
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

/** Shared checks: an admin of a firm that is paying through Stripe. */
// This is the security and sanity check that runs before Cancel or Keep Pro is allowed to touch Stripe.
// Both actions call it first, so the checks live in one place.
// there’s no export: it’s a private helper, so it can’t be called from a form directly.
// Only the two actions can use it

async function requirePaidSubscription() {
  // Who’s asking?
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')
  // Not the demo firm. Visitors to the shared demo can’t change anything, the same guard you use in every action.
  await assertNotDemo()

  // Only firm admins can cancel or resume, since it’s the firm’s money. Hiding the buttons for non-admins (isAdmin && … in the page) is just for appearance; this line is the real protection. Anyone can send a request to a server action without the button, so the server has to check.
  if (orgRole !== 'org:admin')
    throw new Error('Only firm admins can change the plan')

  // Is there actually a paid subscription to change? It’s refused if source !== 'stripe' , plan !== 'pro', no stripeSubscriptionId
  const current = await getOrgPlanDetails(orgId)
  if (
    current.source !== 'stripe' ||
    current.plan !== 'pro' ||
    !current.stripeSubscriptionId
  ) {
    throw new Error('This firm has no active subscription')
  }

  // Hands back the subscription ID (sub_…) from the database.
  return current.stripeSubscriptionId

  /****
   * Why the ID comes from the database and not from the form: if the form sent a subscription ID, someone could edit the request and send another firm’s sub_…, cancelling their subscription. Here the ID is looked up from the signed-in user’s own firm, so you can only ever change your own subscription. It’s the same principle as your matter walls: never trust IDs from the browser for things you can look up yourself.
   ***/
}

/** Cancel at the end of the paid month: the firm keeps Pro until then. */
export async function cancelSubscription() {
  const subscriptionId = await requirePaidSubscription()

  // AWAIT STOPS THE CODE HERE THEN ONCE THE
  // STRIPE ACCOUNT HAS BEEN UPDATED THE NEXT LINE RUNS WHICH IS THE
  // SYNC SUBSCRIPTION LINE WHERE WE PASS IN THE ID N.
  await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
  await syncSubscription(subscriptionId)
  revalidatePath('/app/plan')
}

/** Undo a cancellation before the period ends. */
export async function resumeSubscription() {
  const subscriptionId = await requirePaidSubscription()
  await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
  await syncSubscription(subscriptionId)
  revalidatePath('/app/plan')
}

export type SeatsFormState = { error?: string; saved?: boolean }

/**  ------- Change how many seats the firm pays for. Charged (or credited) straight away. -------  */
export async function changeSeats(
  _prev: SeatsFormState,
  formData: FormData,
): Promise<SeatsFormState> {
  const subscriptionId = await requirePaidSubscription() // admin of a paying firm, or throws
  const { orgId } = await auth()
  if (!orgId) throw new Error('Not authorized')

  // 1. A sensible number.
  const seats = Number(formData.get('seats'))
  const min = PLANS.pro.includedSeats
  if (!Number.isInteger(seats) || seats < min || seats > 200) {
    return { error: `Choose between ${min} and 200 seats.` }
  }

  // 2. Not fewer seats than people already in (or invited to) the firm.
  const clerk = await clerkClient()
  const [members, invites] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 1,
    }),
    clerk.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      status: ['pending'],
      limit: 1,
    }),
  ])
  const inUse = members.totalCount + invites.totalCount
  if (seats < inUse) {
    return {
      error: `Your firm has ${inUse} members and pending invitations. Remove some first, or choose at least ${inUse} seats.`,
    }
  }

  // 3. Look at the subscription as it is now.
  const stripe = getStripe()
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const item = sub.items.data[0]
  if (!item) throw new Error('Subscription has no items')
  if (item.quantity === seats)
    return { error: `You already have ${seats} seats.` }
  if (sub.cancel_at_period_end)
    return {
      error: 'Your subscription is set to cancel. Click Keep Pro first.',
    }

  // 4. Change the quantity. Charge or credit the difference now, and refuse
  //    the whole change if the card is declined.
  try {
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
    })
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      return {
        error: `Your card was declined (${err.message}). Update it under Manage billing and try again.`,
      }
    }
    throw err
  }

  // 5. Copy Stripe's new state into org_plans, and re-render the page.
  await syncSubscription(subscriptionId)
  revalidatePath('/app/plan')
  return { saved: true }
}

// This follows the same pattern as startCheckout
/** Send an admin to Stripe's hosted billing page (card details, invoices). */
export async function openBillingPortal() {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) throw new Error('Not authorized')
  await assertNotDemo()
  if (orgRole !== 'org:admin')
    throw new Error('Only firm admins can manage billing')

  const current = await getOrgPlanDetails(orgId)
  if (!current.stripeCustomerId)
    throw new Error('This firm has no billing account yet')

  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error('APP_URL is not set')

  // billingPortal.sessions.create makes a one-time, short-lived link to
  // Stripe’s portal for that customer. We redirect to it, exactly like Checkout.
  const session = await getStripe().billingPortal.sessions.create({
    customer: current.stripeCustomerId, // whose billing page to open
    return_url: `${appUrl}/app/plan`, // where Stripe's "back" link goes
  })

  redirect(session.url)
}

/**
 *  Why call syncSubscription here when the webhook will do it anyway? The webhook arrives a moment after the action finishes. Without the direct sync, the page would reload still saying “Renews on…”, and the admin would think the click didn’t work. Syncing straight away means the page is right immediately, and when the webhook arrives, it writes the same values again, which is harmless because the upsert is idempotent. Stripe is still the source of truth: both paths read the subscription back from Stripe rather than guessing.
 */

/**
 
  * -> quantity: PLANS.pro.includedSeats (10): the firm starts with 10 seats. With your graduated price, 1–10 all cost £49.99, so they might as well have all ten.
  * -> Three places hold the orgId. Stripe sends your webhook different event types: checkout.session.completed carries the session’s client_reference_id and metadata, while later events like customer.subscription.updated (seat changes, cancellations) only carry the subscription’s metadata. Putting the orgId on both means every future event can say which firm it’s about.
  
  * -> customer vs customer_email: Stripe allows one or the other, not both. The ...( ? : ) spread picks whichever applies.
  
  * -> redirect(session.url) sends the admin’s browser to Stripe’s hosted payment page. That’s an address on checkout.stripe.com, outside your app, which redirect handles fine.
  * -> redirect isn’t in a try/catch on purpose. It works by throwing a special signal that Next.js catches, so a catch around it would swallow the redirect.
  * -> The role check uses orgRole from Clerk: 'org:admin' is Clerk’s built-in admin role for an organisation, the same one that controls who can invite members.
 */
