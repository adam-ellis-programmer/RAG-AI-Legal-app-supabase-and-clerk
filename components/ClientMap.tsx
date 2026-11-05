// components/ClientMap.tsx
'use client'
// The client's location on a Google map, with links to Street View and directions.
// A client component: the map runs in the browser.
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'

export function ClientMap({
  latitude,
  longitude,
  address,
}: {
  latitude: number
  longitude: number
  address: string
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
  if (!apiKey || !mapId) return null // not configured: just no map, rather than an error

  const position = { lat: latitude, lng: longitude }

  return (
    <figure className='mt-4'>
      <div className='h-56 overflow-hidden rounded-lg border border-slate-200'>
        <APIProvider apiKey={apiKey}>
          <Map
            key={`${latitude},${longitude}`} // a new address re-centres the map
            defaultCenter={position}
            defaultZoom={16}
            mapId={mapId}
            gestureHandling='cooperative' // scrolling the page doesn't zoom the map by accident
            clickableIcons={false}
          >
            <AdvancedMarker position={position} title={address} />
          </Map>
        </APIProvider>
      </div>
      <figcaption className='mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400'>
        <span>{address}</span>
        <span className='flex gap-3'>
          <a
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`}
            target='_blank'
            rel='noopener noreferrer'
            className='underline hover:text-slate-600'
          >
            Street View
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target='_blank'
            rel='noopener noreferrer'
            className='underline hover:text-slate-600'
          >
            Directions
          </a>
        </span>
      </figcaption>
    </figure>
  )
}