import L from 'leaflet'
import { type RefObject, useEffect, useMemo, useRef } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { dayLabel } from '../lib/dates'
import type { ListedEvent } from '../types'

const NYC_CENTER: L.LatLngTuple = [40.715, -73.94]
const MAX_POPUP_EVENTS = 5

interface Spot {
  key: string
  position: L.LatLngTuple
  events: ListedEvent[]
}

interface Props {
  results: ListedEvent[]
  today: string
  focus: { id: string; request: number } | null // zoom to this event's pin and open its popup
  fitRequest: number // bumps when the map should zoom to fit every pin
  visible: boolean // on phones the map is hidden behind a tab
  onJump: (id: string) => void
}

export function EventMap({ results, today, focus, fitRequest, visible, onJump }: Props) {
  // Many events share a spot (a rec center, a library), so give each spot one marker.
  const spots = useMemo(() => {
    const byKey = new Map<string, Spot>()
    for (const e of results) {
      if (e.lat == null || e.lng == null) continue
      const key = `${e.lat},${e.lng}`
      const spot = byKey.get(key) ?? { key, position: [e.lat, e.lng], events: [] }
      spot.events.push(e)
      byKey.set(key, spot)
    }
    return [...byKey.values()]
  }, [results])

  const markers = useRef(new Map<string, L.CircleMarker>())

  return (
    <MapContainer id="map" center={NYC_CENTER} zoom={11} preferCanvas>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {spots.map((spot) => (
        <CircleMarker
          key={spot.key}
          center={spot.position}
          radius={Math.min(5 + spot.events.length, 12)}
          pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#1f6f4a', fillOpacity: 0.85 }}
          ref={(marker) => {
            if (marker) markers.current.set(spot.key, marker)
            else markers.current.delete(spot.key)
          }}
        >
          <Popup maxWidth={280}>
            <SpotPopup spot={spot} today={today} onJump={onJump} />
          </Popup>
        </CircleMarker>
      ))}
      <MapController spots={spots} markers={markers} focus={focus} fitRequest={fitRequest} visible={visible} />
    </MapContainer>
  )
}

function SpotPopup({ spot, today, onJump }: { spot: Spot; today: string; onJump: (id: string) => void }) {
  const first = spot.events[0]
  const extra = spot.events.length - MAX_POPUP_EVENTS
  return (
    <>
      <strong>{first.park || first.location}</strong>
      <ul className="popup-list">
        {spot.events.slice(0, MAX_POPUP_EVENTS).map((e) => (
          <li key={e.id}>
            <a href={`#event-${e.id}`} onClick={(ev) => { ev.preventDefault(); onJump(e.id) }}>{e.title}</a>
            <br />
            <small>{dayLabel(e.showDate, today)}, {e.start_time}</small>
          </li>
        ))}
        {extra > 0 && <li><small>+{extra} more here</small></li>}
      </ul>
    </>
  )
}

// Leaflet is imperative, so camera moves happen here in effects rather than through props.
function MapController({ spots, markers, focus, fitRequest, visible }: {
  spots: Spot[]
  markers: RefObject<Map<string, L.CircleMarker>>
  focus: Props['focus']
  fitRequest: number
  visible: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (!focus) return
    const spot = spots.find((s) => s.events.some((e) => e.id === focus.id))
    if (!spot) return
    map.setView(spot.position, Math.max(map.getZoom(), 15))
    markers.current.get(spot.key)?.openPopup()
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fitRequest || !spots.length) return
    map.fitBounds(L.latLngBounds(spots.map((s) => s.position)), { padding: [30, 30], maxZoom: 15 })
  }, [fitRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaflet measures its container once; tell it when the phone layout reveals the map.
  useEffect(() => {
    if (visible) map.invalidateSize()
  }, [visible, map])

  return null
}
