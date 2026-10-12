// lib/money.ts
// Money is stored in pence (whole numbers). These two functions are the only
// places that convert between pence and the pounds people read and type.

/** 125050 → "£1,250.50" */
export function formatPence(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100)
}

/**
 * "1,250.50" or "£1250.5" or "1250" → 125050. Returns null if it isn't a valid amount.
 * Parsed as text rather than multiplied, because 19.99 * 100 in JavaScript
 * is 1998.9999999999998, not 1999.
 */
export function parsePounds(input: string): number | null {
  const s = input.replace(/[£,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}
