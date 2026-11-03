// app/app/settings/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { firmSettings } from '@/lib/schema'
import { isDemoOrg } from '@/lib/demo'
import { LOCALE_OPTIONS, TIME_ZONE_OPTIONS } from '@/lib/dates'

export async function saveFirmSettings(formData: FormData) {
  const { orgId, orgRole } = await auth()
  if (!orgId) throw new Error('No firm selected')
  // Firm admins only, checked here on the server, not just by hiding the button.
  if (orgRole !== 'org:admin') throw new Error('Only firm admins can change firm settings')
  if (isDemoOrg(orgId)) throw new Error('Settings are read-only in the demo firm')

  const locale = String(formData.get('locale') ?? '')
  const timeZone = String(formData.get('timeZone') ?? '')
  // Only values from our own lists: a tampered form can't store anything else.
  if (!LOCALE_OPTIONS.some((o) => o.value === locale)) throw new Error('Unknown date format')
  if (!TIME_ZONE_OPTIONS.some((o) => o.value === timeZone)) throw new Error('Unknown time zone')

  const now = new Date()
  await db
    .insert(firmSettings)
    .values({ orgId, locale, timeZone, updatedAt: now })
    .onConflictDoUpdate({ target: firmSettings.orgId, set: { locale, timeZone, updatedAt: now } })

  revalidatePath('/app', 'layout') // every page re-renders with the new format
  redirect('/app/settings?saved=1')
}


/**
 * orgRole comes from Clerk’s auth(): 'org:admin' or 'org:member' for the active firm.
 * Checking against the lists means even a hand-edited form can only ever store a value you’ve offered. Never trust what a form sends.
 * revalidatePath('/app', 'layout') rebuilds every page under /app, so the new format shows everywhere straight away.
 */