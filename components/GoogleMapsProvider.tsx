// components/GoogleMapsProvider.tsx
'use client'
// Loads Google Maps once for everything inside it (the map and the address search).
import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return <>{children}</> // not configured: the page still works, just without Google
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>
}