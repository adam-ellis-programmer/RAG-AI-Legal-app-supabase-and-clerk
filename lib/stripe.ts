// lib/stripe.ts
// One shared Stripe client, created on first use (same pattern as the Voyage client),
// so a missing key fails with a clear message instead of crashing the build.
import Stripe from 'stripe'

let client: Stripe | null = null

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    client = new Stripe(key)
  }
  return client
}

