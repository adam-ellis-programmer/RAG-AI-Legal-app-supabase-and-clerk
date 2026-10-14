// scripts/check-stripe.ts
// Quick check that STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID are valid.
//   npm run check:stripe
import Stripe from 'stripe'

async function main() {
  // 1. SETUP: build a client holding your key. No network yet.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // 2. THE API CALL: this line sends the HTTPS request to Stripe.
  const p = await stripe.prices.retrieve(process.env.STRIPE_PRO_PRICE_ID!, {
    expand: ['tiers'],
  })

  // 3. USE THE ANSWER: pick out a few fields and print them.
  console.log(
    p.currency,            // 'gbp'
    p.recurring?.interval, // 'month'
    p.tiers_mode,          // 'graduated'
    p.tiers?.map((t) => [t.up_to, t.flat_amount, t.unit_amount]),
  )
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})


// npx tsx --env-file=.env.local -e 'import Stripe from "stripe"; new Stripe(process.env.STRIPE_SECRET_KEY).prices.retrieve(process.env.STRIPE_PRO_PRICE_ID, { expand: ["tiers"] }).then(p => console.log(p.currency, p.recurring?.interval, p.tiers_mode, p.tiers?.map(t => [t.up_to, t.flat_amount, t.unit_amount])))'
