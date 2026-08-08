// app/pricing/page.tsx
import Link from 'next/link'
import Navbar from '@/components/Navbar'

const tiers = [
  {
    name: 'Free',
    price: '£0',
    cadence: '',
    tagline: 'For individuals trying it out.',
    features: [
      '1 organisation',
      'Up to 3 team members',
      'Up to 50 documents',
      'Grounded answers with citations',
      'Community support',
    ],
    cta: 'Start free',
    href: '/sign-up',
    featured: false,
  },
  {
    name: 'Professional',
    price: '£29',
    cadence: '/month',
    tagline: 'For small legal teams.',
    features: [
      'Up to 25 team members',
      'Unlimited documents',
      'Role-based access control',
      'Priority support',
      'Everything in Free',
    ],
    cta: 'Start free trial',
    href: '/sign-up',
    featured: true,
  },
  {
    name: 'Corporate',
    price: 'Contact us',
    cadence: '',
    tagline: 'For firms with advanced needs.',
    features: [
      'Unlimited team members',
      'SSO - SAML & OIDC',
      'Directory sync (SCIM)',
      'Audit logs & data residency',
      'Dedicated support',
    ],
    cta: 'Contact sales',
    href: 'mailto:sales@example.com',
    featured: false,
  },
]

// prettier-ignore
export default function Pricing() {
  return (
    <>
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Pricing</p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight text-slate-900">
            Simple, transparent pricing.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Start free and upgrade when your team grows. Every plan includes grounded,
            cited answers from your own documents.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                t.featured
                  ? 'rounded-2xl bg-slate-900 p-8 text-white shadow-lg'
                  : 'rounded-2xl border border-slate-200 bg-white p-8'
              }
            >
              {t.featured && (
                <span className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  Most popular
                </span>
              )}

              <h2 className="font-serif text-xl">{t.name}</h2>
              <p className={t.featured ? 'mt-1 text-sm text-slate-300' : 'mt-1 text-sm text-slate-500'}>
                {t.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold">{t.price}</span>
                {t.cadence && (
                  <span className={t.featured ? 'text-sm text-slate-300' : 'text-sm text-slate-500'}>
                    {t.cadence}
                  </span>
                )}
              </div>

              <Link
                href={t.href}
                className={
                  t.featured
                    ? 'mt-6 block rounded-md bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-900 transition hover:bg-slate-100'
                    : 'mt-6 block rounded-md bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-slate-800'
                }
              >
                {t.cta}
              </Link>

              <ul className="mt-8 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-slate-400">&#10003;</span>
                    <span className={t.featured ? 'text-slate-200' : 'text-slate-600'}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Prices are placeholders for demonstration. Corporate plans include enterprise
          authentication (SSO / SAML) and directory sync.
        </p>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <span className="font-serif text-slate-900">Lexo<span className="text-slate-400">.</span></span>
          <Link href="/" className="hover:text-slate-900">Home</Link>
          <span>&copy; {new Date().getFullYear()} Lexo. For demonstration only.</span>
        </div>
      </footer>
    </>
  )
}
