// lib/dates.ts
// How dates look. Times are stored in UTC; each firm sees them in its own format
// and time zone. No database imports here, so client components can use it too.
export type DateFormat = { locale: string; timeZone: string }
export const DEFAULT_FORMAT: DateFormat = {
  locale: 'en-GB',
  timeZone: 'Europe/London',
}

export function formatDate(d: Date | string, f: DateFormat = DEFAULT_FORMAT) {
  return new Intl.DateTimeFormat(f.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: f.timeZone,
  }).format(new Date(d))
}

export function formatDateTime(
  d: Date | string,
  f: DateFormat = DEFAULT_FORMAT,
) {
  return new Intl.DateTimeFormat(f.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: f.timeZone,
  }).format(new Date(d))
}

/** For `date` columns (issued_on, date_of_birth): a calendar day, not a moment.
 *  Always UTC, so the day never shifts; only the style follows the firm. */
export function formatDay(day: Date | string, f: DateFormat = DEFAULT_FORMAT) {
  return new Intl.DateTimeFormat(f.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day))
}

/** "17 November 2026" (UK) / "November 17, 2026" (US): for dates in sentences. */
// prettier-ignore
export function formatLongDate(d: Date | string, f: DateFormat = DEFAULT_FORMAT) {
  return new Intl.DateTimeFormat(f.locale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: f.timeZone,
  }).format(new Date(d))
}

// prettier-ignore
// NOT IN USE HERE -- keep for reference
const added = (d: Date) => new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// prettier-ignore
// NOT IN USE HERE -- keep for reference
const longDate = (d: Date) => d.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// NOT IN USE HERE -- keep for reference
function formatDob(dob: string | null) {
  if (!dob) return null
  // 'YYYY-MM-DD' is read as UTC midnight, so format it in UTC too,
  // otherwise a timezone shift could show the day before.
  return new Date(dob).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// The options a firm can choose from. A short, curated list is friendlier than
// all 400+ time zones; add more as firms ask.
export const LOCALE_OPTIONS = [
  { value: 'en-GB', label: 'English (UK): 23 Sept 2026' },
  { value: 'en-US', label: 'English (US): Sep 23, 2026' },
  { value: 'en-IE', label: 'English (Ireland)' },
  { value: 'en-CA', label: 'English (Canada)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-NZ', label: 'English (New Zealand)' },
] as const

export const TIME_ZONE_OPTIONS = [
  { group: 'UK & Ireland', value: 'Europe/London', label: 'London' },
  { group: 'UK & Ireland', value: 'Europe/Dublin', label: 'Dublin' },
  { group: 'Europe', value: 'Europe/Paris', label: 'Paris' },
  { group: 'Europe', value: 'Europe/Berlin', label: 'Berlin' },
  {
    group: 'United States',
    value: 'America/New_York',
    label: 'New York (Eastern)',
  },
  {
    group: 'United States',
    value: 'America/Chicago',
    label: 'Chicago (Central)',
  },
  {
    group: 'United States',
    value: 'America/Denver',
    label: 'Denver (Mountain)',
  },
  {
    group: 'United States',
    value: 'America/Los_Angeles',
    label: 'Los Angeles (Pacific)',
  },
  { group: 'Canada', value: 'America/Toronto', label: 'Toronto' },
  { group: 'Canada', value: 'America/Vancouver', label: 'Vancouver' },
  { group: 'Australia & NZ', value: 'Australia/Sydney', label: 'Sydney' },
  { group: 'Australia & NZ', value: 'Australia/Perth', label: 'Perth' },
  { group: 'Australia & NZ', value: 'Pacific/Auckland', label: 'Auckland' },
  { group: 'Asia & Middle East', value: 'Asia/Singapore', label: 'Singapore' },
  { group: 'Asia & Middle East', value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { group: 'Asia & Middle East', value: 'Asia/Dubai', label: 'Dubai' },
] as const

/**
 ** Why use time zone names like America/New_York instead of offsets like “UTC−5”: the name knows about daylight saving. New York is UTC−5 in winter and UTC−4 in summer, and Intl switches automatically on the right dates. A fixed offset would be an hour wrong for half the year.
 ** Why it has no database import: the settings form (a client component) needs these lists for its dropdowns. If this file imported db, the database code would get pulled into the browser bundle, the same problem you hit with lib/plan.ts.
 */
