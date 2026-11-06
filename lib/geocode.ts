// lib/geocode.ts
// Postcode → map position, via postcodes.io (free UK postcode data, no key).
// Only the POSTCODE is sent: never the client's name or house number.
// Kept in one function so a firm outside the UK can swap in another geocoder later.
export type LatLng = { latitude: number; longitude: number }

export async function geocodeUkPostcode(
  postcode: string,
): Promise<LatLng | null> {
  const pc = postcode.trim()
  if (!pc) return null
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
      {
        signal: AbortSignal.timeout(3000), // a slow lookup must never hold up saving
        cache: 'no-store',
      },
    )

    if (!res.ok) return null // 404 = no such postcode

    const data = (await res.json()) as {
      result?: { latitude: number | null; longitude: number | null }
    }

    const { latitude, longitude } = data.result ?? {}

    return typeof latitude === 'number' && typeof longitude === 'number'
      ? { latitude, longitude }
      : null
  } catch {
    return null // offline, timed out, etc.: save the address anyway, just without a map
  }
}
