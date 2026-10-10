// Brooklyn Bridge Park's events, from the WordPress API behind brooklynbridgepark.org.
//
// Fitness classes, stargazing, bird walks, workshops and festivals on the Brooklyn waterfront.
// Each event points at a "map location" (Pier 3, Pier 6 ...) that has exact coordinates.
import he from 'he'

import { get, makeEvent, stripHtml } from '../common.js'
import type { NycEvent, Source } from '../types.js'

export const NAME = 'Brooklyn Bridge Park'
const API = 'https://brooklynbridgepark.org/wp-json/wp/v2'
const MAX_PAGES = 12 // ~100 events per page; the site has ~700 events, past and future

interface Acf {
  date?: string
  end_date?: string
  'multi-day'?: boolean
  start_time?: string
  end_time?: string
  description?: string
  status?: string
  event_location?: number[]
  latitude?: string
  longitude?: string
  name?: string
}

interface Post {
  id: number
  link?: string
  title: { rendered: string }
  acf?: Acf | unknown[]
  event_category?: number[]
}

type Locations = Record<number, Acf>
type Categories = Record<number, string>

export async function fetch(): Promise<NycEvent[]> {
  const locations: Locations = {}
  for (const loc of await getAll('maplocations', 'id,acf')) {
    locations[(loc as { id: number }).id] = ((loc as { acf?: Acf }).acf ?? {}) as Acf
  }

  const categories: Categories = {}
  for (const c of await getAll('event_category', 'id,name')) {
    const cat = c as { id: number; name: string }
    categories[cat.id] = he.decode(cat.name)
  }

  // Yesterday as YYYYMMDD, with a day of slack.
  const cutoff = isoCompact(new Date(Date.now() - 24 * 60 * 60 * 1000))

  const events: NycEvent[] = []
  // Events are ordered by when they were posted, not when they happen, so upcoming ones
  // are spread across every page and we have to read them all.
  for (const post of (await getAll('events', 'id,link,title,acf,event_category')) as Post[]) {
    const acf = post.acf
    if (acf && !Array.isArray(acf) && (acf.date ?? '') >= cutoff) {
      events.push(toEvent(post, locations, categories))
    }
  }
  return events
}

async function getAll(endpoint: string, fields: string): Promise<unknown[]> {
  const items: unknown[] = []
  let page = 1
  let totalPages = 1
  while (page <= Math.min(totalPages, MAX_PAGES)) {
    const resp = await get(`${API}/${endpoint}`, { per_page: 100, page, _fields: fields })
    items.push(...((await resp.json()) as unknown[]))
    totalPages = Number(resp.headers.get('X-WP-TotalPages') ?? 1)
    page += 1
  }
  return items
}

// Exported for tests.
export function toEvent(post: Post, locations: Locations, categories: Categories): NycEvent {
  const acf = post.acf as Acf
  const locationIds = acf.event_location ?? []
  const place = locationIds.length ? (locations[locationIds[0]!] ?? {}) : {}
  const lat = toFloat(place.latitude)
  const lng = toFloat(place.longitude)
  return makeEvent({
    source: NAME,
    id: post.id,
    title: post.title.rendered,
    description: stripHtml(acf.description),
    url: post.link ?? null,
    park: NAME,
    location: place.name ?? '',
    borough: 'Brooklyn',
    start_date: toIsoDate(acf.date),
    end_date: acf['multi-day'] ? toIsoDate(acf.end_date) : null,
    start_time: acf.start_time || null,
    end_time: acf.end_time || null,
    categories: (post.event_category ?? [])
      .filter((c) => c in categories)
      .map((c) => categories[c]!),
    lat: lng !== null ? lat : null,
    lng: lat !== null ? lng : null,
    canceled: (acf.status ?? '').toLowerCase().startsWith('cancel'),
  })
}

// '20261003' -> '2026-10-03'.
function toIsoDate(value: string | undefined): string | null {
  const v = String(value ?? '')
  return v.length === 8 && /^\d+$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null
}

function toFloat(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : Math.round(n * 1e6) / 1e6
}

function isoCompact(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

const source: Source = { NAME, fetch }
export default source
