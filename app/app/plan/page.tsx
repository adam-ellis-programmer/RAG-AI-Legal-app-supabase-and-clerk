// app/app/plan/page.tsx
// The firm's plan: what they're on, usage this month, and the way to upgrade.
import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrgPlanDetails, PLANS } from '@/lib/plan'
import { questionsUsedThisMonth } from '@/lib/firm-quota'
import { isDemoOrg } from '@/lib/demo'
import { SubmitButton } from '@/components/SubmitButton'
import { SeatsForm } from '@/components/SeatsForm'
import {
  startCheckout,
  cancelSubscription,
  resumeSubscription,
  openBillingPortal,
} from './actions'

const longDate = (d: Date) =>
  d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) redirect('/app')

  if (isDemoOrg(orgId)) {
    return (
      <main className='mx-auto max-w-2xl p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>Plan</h1>
        <p className='mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200'>
          This is the shared demo firm, so it has no plan. Sign up with your own
          firm to see plans and upgrade.
        </p>
      </main>
    )
  }

  const { checkout } = await searchParams
  const isAdmin = orgRole === 'org:admin'

  const clerk = await clerkClient()
  const [details, used, members] = await Promise.all([
    getOrgPlanDetails(orgId),
    questionsUsedThisMonth(orgId),
    clerk.organizations
      .getOrganizationMembershipList({ organizationId: orgId, limit: 1 })
      .then((r) => r.totalCount),
  ])

  const plan = PLANS[details.plan]
  const percent = Math.min(
    100,
    Math.round((used / plan.questionsPerMonth) * 100),
  )

  return (
    <main className='mx-auto max-w-2xl p-6'>
      <h1 className='text-2xl font-semibold text-slate-900'>Plan</h1>
      <p className='mt-1 text-sm text-slate-500'>
        Your firm&apos;s plan and usage this month.
      </p>

      {checkout === 'success' && (
        <p className='mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200'>
          Payment received. Your plan will switch to Pro as soon as Stripe
          confirms it, usually within a few seconds.
        </p>
      )}
      {checkout === 'cancelled' && (
        <p className='mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200'>
          Checkout cancelled. Nothing was charged.
        </p>
      )}

      <section className='mt-6 rounded-xl border border-slate-200 p-4'>
        <div className='flex items-center gap-2'>
          <h2 className='text-lg font-semibold text-slate-900'>{plan.label}</h2>
          {details.source === 'comp' && (
            <span className='rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700'>
              Complimentary
            </span>
          )}
        </div>

        <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
          <div className='rounded-lg border border-slate-200 p-3'>
            <dt className='text-xs text-slate-500'>Questions this month</dt>
            <dd className='mt-1 font-medium text-slate-900'>
              {used.toLocaleString('en-GB')} of{' '}
              {plan.questionsPerMonth.toLocaleString('en-GB')}
            </dd>
            <div className='mt-2 h-1.5 rounded-full bg-slate-100'>
              <div
                className={`h-1.5 rounded-full ${percent >= 90 ? 'bg-amber-500' : 'bg-slate-900'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <div className='rounded-lg border border-slate-200 p-3'>
            <dt className='text-xs text-slate-500'>Members</dt>
            <dd className='mt-1 font-medium text-slate-900'>
              {members}
              {details.seats !== null && ` of ${details.seats} seats`}
            </dd>
          </div>
        </dl>
      </section>

      {details.plan === 'free' &&
        (isAdmin ? (
          <section className='mt-6 rounded-xl border border-slate-900 p-4'>
            <h2 className='font-semibold text-slate-900'>Upgrade to Pro</h2>
            <p className='mt-1 text-sm text-slate-600'>
              {PLANS.pro.questionsPerMonth.toLocaleString('en-GB')} questions a
              month. {PLANS.pro.priceText}.
            </p>
            {/* --------------- start checkout form ---------------------- */}
            <form action={startCheckout} className='mt-3'>
              <SubmitButton
                pendingText='Opening checkout…'
                className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
              >
                Upgrade to Pro
              </SubmitButton>
            </form>
          </section>
        ) : (
          <p className='mt-6 text-sm text-slate-500'>
            Ask a firm admin to upgrade to Pro.
          </p>
        ))}

      {/* ----- pro block --------- */}

      {details.plan === 'pro' && details.source === 'stripe' && (
        <section className='mt-6 rounded-xl border border-slate-200 p-4 text-sm'>
          <h2 className='font-semibold text-slate-900'>Subscription</h2>

          {details.cancelAt ? (
            <>
              <p className='mt-2 rounded-lg bg-amber-50 p-3 text-amber-800 ring-1 ring-amber-200'>
                Your subscription is cancelled. You keep Pro until{' '}
                <strong>{longDate(details.cancelAt)}</strong>; after that your
                firm moves to the Free plan ({PLANS.free.questionsPerMonth}{' '}
                questions a month). Nothing more will be charged.
              </p>
              {/* ----------- resume subscription form -------------------- */}
              {isAdmin && (
                <form action={resumeSubscription} className='mt-3'>
                  <SubmitButton
                    pendingText='Saving…'
                    className='rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800'
                  >
                    Keep Pro
                  </SubmitButton>
                </form>
              )}
            </>
          ) : (
            <>
              <p className='mt-2 text-slate-600'>
                {details.currentPeriodEnd
                  ? `Renews on ${longDate(details.currentPeriodEnd)}.`
                  : 'Active.'}
              </p>
              {isAdmin && (
                <>
                  {/*  --------------- change seats dropdown ---------------  */}
                  <details className='mt-3'>
                    <summary className='cursor-pointer text-slate-500 hover:text-slate-900'>
                      Change seats
                    </summary>
                    <div className='mt-2'>
                      <SeatsForm
                        currentSeats={details.seats ?? PLANS.pro.includedSeats}
                        minSeats={Math.max(PLANS.pro.includedSeats, members)}
                        includedSeats={PLANS.pro.includedSeats}
                        flatFeePence={PLANS.pro.flatFeePence}
                        extraSeatPence={PLANS.pro.extraSeatPence}
                      />
                    </div>
                  </details>
                  <details className='mt-3'>
                    <summary className='cursor-pointer text-slate-500 hover:text-slate-900'>
                      Cancel subscription
                    </summary>

                    <div className='mt-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200'>
                      <p className='text-slate-700'>
                        Your firm keeps Pro until the end of the period
                        you&apos;ve paid for
                        {details.currentPeriodEnd &&
                          ` (${longDate(details.currentPeriodEnd)})`}
                        , then moves to Free. You can undo this any time before
                        then.
                      </p>
                      {/* -------- cancel subscription form ---------------------- */}
                      <form action={cancelSubscription} className='mt-3'>
                        <SubmitButton
                          pendingText='Cancelling…'
                          className='rounded-md border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50'
                        >
                          Confirm cancellation
                        </SubmitButton>
                      </form>
                    </div>
                  </details>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* --------------------- open billing portal --------------------- */}
      {isAdmin && details.stripeCustomerId && (
        <form action={openBillingPortal} className='mt-6'>
          <SubmitButton
            pendingText='Opening…'
            className='text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900'
          >
            Manage billing: payment method and invoices
          </SubmitButton>
        </form>
      )}
    </main>
  )
}

/**
 *  Promise.all([...]) runs the three lookups (your database twice, Clerk once) at the same time instead of one after another, so the page loads faster.
 *  searchParams is a Promise in Next.js 16, which is why it’s awaited. It’s how the page reads the ?checkout=success that Stripe sends people back with.
 *  The “Manage billing” button for firms that already pay comes in step 5. It needs the webhook data first.
 */
