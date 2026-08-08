// app/page.tsx
import Link from 'next/link'
import { Show } from '@clerk/nextjs'
import Navbar from '@/components/Navbar'

const steps = [
  { n: '01', title: 'Upload', body: 'Add contracts, agreements, and filings as PDFs or pasted text.' },
  { n: '02', title: 'Ask', body: 'Ask questions in plain English, the way you would ask a colleague.' },
  { n: '03', title: 'Verify', body: 'Read the answer with citations linking to the exact source passage.' },
]

const features = [
  { title: 'Grounded in your documents', body: 'Answers come only from what you upload - no outside sources, no guessing.' },
  { title: 'Cited to the source', body: 'Every answer links back to the passage it came from, so you can verify before you rely on it.' },
  { title: 'Private by tenant', body: 'Each organisation\'s documents are isolated. Your data is never shared across firms.' },
]

export default function Home() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Document intelligence for legal teams
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Answers you can trace back to the source.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-600">
              Upload your contracts and filings, ask questions in plain English, and get
              answers grounded in your own documents &mdash; every claim cited to its source.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <Link href="/sign-up" className="rounded-md bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                  Start free
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/app" className="rounded-md bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                  Open the app
                </Link>
              </Show>
              <Link href="/pricing" className="rounded-md border border-slate-300 px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
                See pricing
              </Link>
            </div>
          </div>

          {/* Signature element: a cited answer, mirroring the real product output */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Question</p>
            <p className="mt-2 text-slate-900">How long does the confidentiality term last?</p>
            <div className="my-5 h-px bg-slate-100" />
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Answer</p>
            <p className="mt-2 leading-relaxed text-slate-700">
              The confidentiality obligations remain in effect for a period of three years
              from the date of execution.<sup className="ml-0.5 text-slate-400">[1]</sup>
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">[1]</span>
              Mutual_NDA.pdf &middot; clause 3
            </div>
          </div>
        </div>
      </section>

      {/* How it works - a real sequence, so numbering is meaningful */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-serif text-2xl text-slate-900">How it works</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="font-serif text-2xl text-slate-300">{s.n}</div>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-serif text-2xl text-white">Put your documents to work.</h2>
            <p className="mt-2 text-sm text-slate-300">Start free &mdash; no card required.</p>
          </div>
          <Link href="/sign-up" className="rounded-md bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
            Start free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <span className="font-serif text-slate-900">Lexo<span className="text-slate-400">.</span></span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/sign-in" className="hover:text-slate-900">Sign in</Link>
          </div>
          <span>&copy; {new Date().getFullYear()} Lexo. For demonstration only.</span>
        </div>
      </footer>
    </>
  )
}