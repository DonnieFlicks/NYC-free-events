// NYC Parks' public events feed: ~1,000 events over the next two weeks, with map coordinates.
import { cleanText, get, makeEvent } from '../common.js'
import type { NycEvent, Source } from '../types.js'

export const NAME = 'NYC Parks'
const FEED_URL = 'https://www.nycgovparks.org/xml/events_300_rss.json'

const BOROUGHS: Record<string, string> = {
  M: 'Manhattan',
  X: 'Bronx',
  B: 'Brooklyn',
  Q: 'Queens',
  R: 'Staten Island',
}

interface RawEvent {
  guid?: string
  title?: string
  description?: string
  link?: string
  registration_url?: string
  registration_description?: string
  parknames?: string
  parkids?: string
  location?: string
  coordinates?: string
  startdate?: string
  enddate?: string
  starttime?: string
  endtime?: string
  categories?: string
  image?: string
}

export async function fetch(): Promise<NycEvent[]> {
  const raw = (await (await get(FEED_URL)).json()) as RawEvent[]
  const events = raw.map(toEvent)
  fillMissingBoroughs(events)
  return events
}

function toEvent(raw: RawEvent): NycEvent {
  const borough = guessBorough(raw)
  // Online events carry a placeholder Midtown pin, which would be misleading on a map.
  const [lat, lng] = borough === 'Online' ? [null, null] : parseCoordinates(raw.coordinates)
  return makeEvent({
    source: NAME,
    id: raw.guid ?? '',
    title: raw.title,
    description: raw.description,
    url: https(raw.link),
    registration_url: raw.registration_url ?? null,
    park: raw.parknames,
    location: raw.location,
    borough,
    start_date: raw.startdate ?? null,
    end_date: raw.enddate ?? null,
    start_time: raw.starttime ?? null,
    end_time: raw.endtime ?? null,
    categories: (raw.categories ?? '')
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean),
    lat,
    lng,
    image: https(raw.image),
    cost_text: cleanText(raw.registration_description),
  })
}

function https(url: string | null | undefined): string | null {
  return (url ?? '').replace('http://', 'https://') || null
}

// Exported for tests.
export function guessBorough(raw: RawEvent): string | null {
  if ((raw.location ?? '').toLowerCase().includes('virtual')) return 'Online'
  // Park IDs start with a borough letter, e.g. "M072" is in Manhattan.
  const parkId = (raw.parkids ?? '').trim().toUpperCase()
  const first = parkId.slice(0, 1)
  if (first in BOROUGHS) return BOROUGHS[first]!
  // Events outside parks (libraries, community centers) often name the borough.
  const place = `${raw.location ?? ''} ${raw.parknames ?? ''}`.toLowerCase()
  for (const name of Object.values(BOROUGHS)) {
    if (place.includes(name.toLowerCase())) return name
  }
  return null
}

interface Located {
  borough: string | null
  lat: number | null
  lng: number | null
}

// Give each event with no known borough the borough of the closest event that has one.
// Exported for tests.
export function fillMissingBoroughs(events: Located[]): void {
  const known = events.filter(
    (e) => e.borough && e.borough !== 'Online' && e.lat !== null,
  ) as Array<Located & { lat: number; lng: number; borough: string }>
  if (known.length === 0) return
  for (const event of events) {
    if (event.borough || event.lat === null) continue
    const lat = event.lat
    const lng = event.lng!
    let nearest = known[0]!
    let best = Infinity
    for (const k of known) {
      const dist = (k.lat - lat) ** 2 + (k.lng - lng) ** 2
      if (dist < best) {
        best = dist
        nearest = k
      }
    }
    event.borough = nearest.borough
  }
}

function parseCoordinates(value: string | null | undefined): [number | null, number | null] {
  if (!value) return [null, null]
  const parts = value.split(',')
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (parts.length < 2 || Number.isNaN(lat) || Number.isNaN(lng)) return [null, null]
  return [round6(lat), round6(lng)]
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

const source: Source = { NAME, fetch }
export default source
