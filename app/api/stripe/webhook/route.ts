// app/api/stripe/webhook/route.ts
// Stripe calls this when something happens to a firm's subscription.
// It catches every change, including ones made outside the app (renewals,
// the period ending, failed payments, the Stripe dashboard or portal).
// The plan actions also sync straight after a click, so the page is right
// immediately; both use syncSubscription() in lib/billing.ts.

import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { syncSubscription } from '@/lib/billing' // was in this file but now is shared in lib/billing

// Statuses where the firm keeps Pro. 'past_due' means a renewal payment failed
// and Stripe is retrying it: we give them that grace period rather than cutting off.

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret)
    return new Response('Webhook secret not configured', { status: 500 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  // The raw text, exactly as Stripe sent it. The signature is calculated over
  // these exact bytes, so we must not parse it as JSON first.
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      // only runs when someone finished the Checkout page
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          await syncSubscription(String(session.subscription))
        }
        break
      }
      // customer.subscription.updated: something about this subscription changed
      // customer.subscription.deleted: the subscription has ended

      /**
       .deleted fires when:
              *  the paid period runs out after a cancellation (e.g. on 17 November, after they clicked Cancel)
              *  it’s cancelled immediately (the dashboard’s “Cancel immediately”, as in your tests)
              *  the customer is deleted (your reset-billing script), which ends all their subscriptions
              *  payment retries run out, if Stripe’s settings say to cancel at that point
              * 
              * In short:
              *    Event	Means	Your app does
              *    .completed	a checkout finished → subscription started	firm → Pro
              *    .updated	the subscription changed	copy the new seats, dates, cancel state and status
              *    .deleted	the subscription ended	firm → Free
       */
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object.id)
        break
      // Every other event type is ignored, but still answered with 200 below.
    }
  } catch (err) {
    console.error('Stripe webhook failed', event.type, err)
    // A 500 tells Stripe to try again later.
    return new Response('Webhook handler failed', { status: 500 })
  }

  return Response.json({ received: true })
}

/**
 *   The signature check (constructEvent): this URL is public, so anyone could POST “firm X paid” to it. Stripe signs every message using your whsec_ secret, and constructEvent recalculates the signature and refuses anything that doesn’t match. Without this check, the webhook would be a free “upgrade to Pro” button for anyone who found the URL.
 *   req.text(), not req.json(): the signature covers the exact bytes Stripe sent. Parsing and re-serialising the JSON could change spacing or key order, and the check would fail.
 *   It always fetches the subscription fresh (subscriptions.retrieve). Stripe doesn’t guarantee events arrive in order, and it retries failed ones. If an old “quantity 10” event arrived after a newer “quantity 15” one, using the event’s own data would roll the seats back. Asking Stripe for the current state each time makes the order irrelevant.
 *   The upsert (onConflictDoUpdate) makes the handler idempotent: processing the same event twice gives the same result. That matters because Stripe will sometimes deliver an event more than once.
 *   Cancelling keeps the row, with plan = 'free', rather than deleting it. The firm drops to Free, but the stripe_customer_id is kept, so if they upgrade again, startCheckout reuses their Stripe customer (with their history and saved card) instead of creating a duplicate.
 *   A 200 for events we ignore, a 500 when something breaks: Stripe treats anything other than 2xx as “not delivered” and retries for up to a few days. So a temporary database hiccup heals itself on a retry.
 */

/**
 * proxy.ts uses clerkMiddleware() with no arguments, so this route is already reachable without signing in, the same as your cron route. That’s correct, because Stripe isn’t a signed-in user. The signature check is its protection instead.
 */
