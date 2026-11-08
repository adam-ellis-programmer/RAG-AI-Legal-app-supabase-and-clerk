// components/AddressAutocomplete.tsx

'use client'
// Google's address search. Picking a suggestion hands back the address split
// into our fields, plus its exact position.
import { useEffect, useRef } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'

export type PickedAddress = {
  addressLine1: string
  addressLine2: string
  town: string
  postcode: string
  latitude: number
  longitude: number
}

type AddressPart = { longText: string | null; types: string[] }

// Find one part of the address by its Google type, e.g. 'postal_code'.
function part(parts: AddressPart[], type: string) {
  return parts.find((p) => p.types.includes(type))?.longText ?? ''
}

export function AddressAutocomplete({
  onPick,
}: {
  onPick: (a: PickedAddress) => void
}) {
  const places = useMapsLibrary('places') // null until Google's "places" code has loaded
  const boxRef = useRef<HTMLDivElement>(null)

  // Always call the latest onPick without rebuilding the search box.
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    if (!places || !boxRef.current) return

    // Google's ready-made search box (a "web component"), limited to UK addresses.
    const el = new places.PlaceAutocompleteElement({
      includedRegionCodes: ['gb'],
    })
    el.style.width = '100%'
    boxRef.current.replaceChildren(el)

    async function handleSelect(event: Event) {
      const { placePrediction } = event as unknown as {
        placePrediction: google.maps.places.PlacePrediction
      }
      const place = placePrediction.toPlace()
      // Ask Google only for what we use. Fewer fields keep the request cheaper.
      await place.fetchFields({ fields: ['addressComponents', 'location'] })

      const parts = (place.addressComponents ?? []) as AddressPart[]
      const location = place.location
      if (!location) return

      const street = [part(parts, 'street_number'), part(parts, 'route')]
        .filter(Boolean)
        .join(' ')
      const building = [part(parts, 'subpremise'), part(parts, 'premise')]
        .filter(Boolean)
        .join(', ')

      onPickRef.current({
        addressLine1: [building, street].filter(Boolean).join(', '),
        addressLine2:
          part(parts, 'sublocality_level_1') || part(parts, 'neighborhood'),
        town: part(parts, 'postal_town') || part(parts, 'locality'),
        postcode: part(parts, 'postal_code'),
        latitude: location.lat(),
        longitude: location.lng(),
      })
    }

    el.addEventListener('gmp-select', handleSelect)
    return () => {
      el.removeEventListener('gmp-select', handleSelect)
      el.remove()
    }
  }, [places])

  return <div ref={boxRef} />
}

/**
 How it works:

        useMapsLibrary('places') loads Google’s address-search code. It returns null at first, so the effect waits until it’s ready.
        PlaceAutocompleteElement is Google’s own search box: a web component, a self-contained custom HTML element. We create it in code and put it inside our <div>.
        'gmp-select' is the event Google fires when someone picks a suggestion. toPlace() turns the suggestion into a place, and fetchFields asks Google for just the details we need.
        addressComponents comes back as labelled parts (street_number, route, postal_town, postal_code…), and part() picks each one out to fill your fields. UK addresses use postal_town for the town (“London”, “Leeds”), with locality as a fallback.
        includedRegionCodes: ['gb']: UK addresses only. Easy to widen later for firms elsewhere.
        The cleanup removes the box and its listener when the form closes, so nothing is left behind.
 */
