// lib/money.ts
// Money is stored in pence (whole numbers: the smallest unit, whatever the
// currency). These are the only places that convert between stored amounts and
// what people read and type. No database imports: client components use it too.

/** What formatPence needs: a locale for the style ("1,250.50" vs "1.250,50")
 *  and an ISO currency code ("GBP", "USD"). The firm's fmt object fits this. */
export type MoneyFormat = { locale: string; currency: string }

/** Citewise's own prices (plans, seats) are always in pounds, whatever the firm bills in. */
export const GBP: MoneyFormat = { locale: 'en-GB', currency: 'GBP' }

/** 125050 → "£1,250.50" (or "$1,250.50", "€1,250.50"… with the firm's fmt).
 *  With no format it uses GBP, which is what SeatsForm (Citewise's price) wants. */
export function formatPence(pence: number, f: MoneyFormat = GBP) {
  return new Intl.NumberFormat(f.locale, {
    style: 'currency',
    currency: f.currency,
    currencyDisplay: 'narrowSymbol', // "$" rather than "US$", "€" for euros, "£" for pounds
  }).format(pence / 100)
}

/**
 * "1,250.50", "£1250.5", "$1250" or "1250" → 125050. Returns null if it isn't a valid amount.
 * Any currency symbol in front is ignored, so a US firm can type "$500".
 * Parsed as text rather than multiplied, because 19.99 * 100 in JavaScript
 * is 1998.9999999999998, not 1999.
 */
export function parsePounds(input: string): number | null {
  const s = input
    .trim()
    .replace(/^[^\d]+/, '') // drop anything before the first digit: "£", "$", "US$", "€ "
    .replace(/[,\s]/g, '') // drop thousands separators and spaces
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** The currencies a firm can bill in. A short list, like the time zones; add more as firms ask. */
export const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'Pound sterling (£)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'USD', label: 'US dollar ($)' },
  { value: 'CAD', label: 'Canadian dollar (CA$)' },
  { value: 'AUD', label: 'Australian dollar (A$)' },
  { value: 'NZD', label: 'New Zealand dollar (NZ$)' },
  { value: 'SGD', label: 'Singapore dollar (S$)' },
  { value: 'HKD', label: 'Hong Kong dollar (HK$)' },
  { value: 'AED', label: 'UAE dirham (AED)' },
] as const

/** Just the symbol for a format: "£", "US$", "€". For labels like "Amount (£)". */
export function currencySymbol(f: MoneyFormat = GBP) {
  return (
    new Intl.NumberFormat(f.locale, { style: 'currency', currency: f.currency, currencyDisplay: 'narrowSymbol', })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? f.currency
  )
}

