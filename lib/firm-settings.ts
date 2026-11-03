// lib/firm-settings.ts
// Server-only: the firm's date format, looked up once per request.
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { firmSettings } from '@/lib/schema'
import { DEFAULT_FORMAT, type DateFormat } from '@/lib/dates'

// prettier-ignore
export const getFirmFormat = cache(async (orgId: string): Promise<DateFormat> => {
  const [row] = await db
    .select({ locale: firmSettings.locale, timeZone: firmSettings.timeZone })
    .from(firmSettings)
    .where(eq(firmSettings.orgId, orgId))
    .limit(1)
  return row ?? DEFAULT_FORMAT // no row yet → the defaults
})

// cache again: if the layout and the page both ask for it, the database is only queried once per request.
