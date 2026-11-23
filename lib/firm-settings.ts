// lib/firm-settings.ts
// Server-only: the firm's display format (dates + money), looked up once per request.
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { firmSettings } from '@/lib/schema'
import { DEFAULT_FORMAT, type DateFormat } from '@/lib/dates'
import { GBP, type MoneyFormat } from '@/lib/money'

/** Everything a page needs to show dates and money the firm's way.
 *  It fits DateFormat AND MoneyFormat, so the same fmt goes to both. */
export type FirmFormat = DateFormat & MoneyFormat

// prettier-ignore
export const DEFAULT_FIRM_FORMAT: FirmFormat = { ...DEFAULT_FORMAT, currency: GBP.currency }

// cache: if the layout and the page both ask for it, the database is only queried once per request.
// prettier-ignore
export const getFirmFormat = cache(async (orgId: string): Promise<FirmFormat> => {
  const [row] = await db
    .select({
      locale: firmSettings.locale,
      timeZone: firmSettings.timeZone,
      currency: firmSettings.currency,
    })
    .from(firmSettings)
    .where(eq(firmSettings.orgId, orgId))
    .limit(1)
  return row ?? DEFAULT_FIRM_FORMAT // no row yet → the defaults
})

/** The firm's chat toast setting: characters of message text to show (0 = name only). */
// prettier-ignore
export const getChatPreviewLength = cache(async (orgId: string): Promise<number> => {
  const [row] = await db
    .select({ n: firmSettings.chatPreviewLength })
    .from(firmSettings)
    .where(eq(firmSettings.orgId, orgId))
    .limit(1)
  return row?.n ?? 0 // no settings row yet → off

  /** It's kept separate from getFirmFormat because FirmFormat 
   * is about how things look (dates and money) and gets passed 
   * to dozens of components. Only the app layout needs this setting. */
})
