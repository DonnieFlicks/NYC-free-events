// Helpers shared by every event source: HTTP, text cleanup, and the common event shape.
import he from 'he'

import type { Cost, NycEvent } from './types.js'

const HEADERS = { 'User-Agent': 'nyc-free-events-app/0.1 (learning project)' }
const TIMEOUT_MS = 20_000

// A dollar amount near a word like "admission" or "tickets" means the event costs money.
// (A bare "$30 million" in a park's history blurb shouldn't count.)
const PAID_RE =
  /\b(admission|tickets?|fees?|costs?|price|charge)\b[^.]{0,60}?\$\s?\d|\$\s?\d+(\.\d\d)?\s*(per|\/|each)\b/i
const DONATION_RE = /suggested donation|pay what you (wish|can)/i
// Some sources only flag cancellations in the title ("CANCELED: Tai Chi").
const CANCELED_RE = /^cancel+ed\b/i

export async function get(
  url: string,
  params?: Record<string, string | number>,
): Promise<Response> {
  const target = new URL(url)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, String(value))
    }
  }
  const resp = await fetch(target, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText} for ${target.href}`)
  return resp
}

export interface MakeEventInput {
  source: string
  id: string | number
  title?: string | null
  start_date?: string | null
  description?: string | null
  url?: string | null
  registration_url?: string | null
  park?: string | null
  location?: string | null
  borough?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  categories?: readonly string[]
  lat?: number | null
  lng?: number | null
  image?: string | null
  canceled?: boolean
  cost_text?: string
}

// Build an event in the one shape the frontend understands, whatever the source.
export function makeEvent(input: MakeEventInput): NycEvent {
  const title = cleanText(input.title)
  const description = cleanText(input.description)
  return {
    id: `${sourceSlug(input.source)}-${input.id}`,
    source: input.source,
    title,
    canceled: Boolean(input.canceled) || CANCELED_RE.test(title),
    description,
    url: input.url ?? null,
    registration_url: input.registration_url ?? null,
    park: cleanText(input.park),
    location: cleanText(input.location),
    borough: input.borough ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? input.start_date ?? null,
    start_time: input.start_time ?? null,
    end_time: input.end_time ?? null,
    start_minutes: minutesSinceMidnight(input.start_time),
    end_minutes: minutesSinceMidnight(input.end_time),
    categories: [...(input.categories ?? [])],
    cost: classifyCost(`${title} ${description} ${input.cost_text ?? ''}`),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    image: input.image ?? null,
  }
}

export function sourceSlug(source: string): string {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function cleanText(text: string | null | undefined): string {
  if (!text) return ''
  // he.decode turns "&nbsp;" into U+00A0; swap that for a plain space like Python's replace("\xa0").
  let out = he.decode(text).replace(/ /g, ' ')
  // Feeds often strip <p> tags, gluing sentences together ("colors!NYRR"); put the space back.
  out = out.replace(/([.!?])([A-Z])/g, '$1 $2')
  return out.replace(/\s+/g, ' ').trim()
}

export function stripHtml(text: string | null | undefined): string {
  const spaced = (text ?? '').replace(/<br\s*\/?>|<\/p>|<\/li>/gi, ' ')
  return cleanText(spaced.replace(/<[^>]+>/g, ''))
}

// 'donation', 'paid', or 'free'. Events are assumed free unless the text says otherwise.
export function classifyCost(text: string): Cost {
  if (DONATION_RE.test(text)) return 'donation'
  if (PAID_RE.test(text)) return 'paid'
  return 'free'
}

// '8:00 am' -> 480. Used to sort events within a day.
export function minutesSinceMidnight(value: string | null | undefined): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*([ap])\.?m/i.exec(value ?? '')
  if (!match) return null
  const hour = Number(match[1]) % 12
  const minute = Number(match[2])
  const half = match[3]!.toLowerCase()
  return (hour + (half === 'p' ? 12 : 0)) * 60 + minute
}
