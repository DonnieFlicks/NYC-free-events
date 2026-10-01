import type { ListedEvent, NycEvent } from '../types'
import { dateRange, type When } from './dates'

export interface Filters {
  when: When
  boroughs: string[] // empty means every borough
  category: string
  source: string
  kids: boolean
  donation: boolean // include "suggested donation" events
  query: string
}

export const DEFAULT_FILTERS: Filters = {
  when: 'today',
  boroughs: [],
  category: '',
  source: '',
  kids: false,
  donation: true,
  query: '',
}

export interface Clock {
  today: string // YYYY-MM-DD in New York
  minutes: number // minutes since midnight in New York
}

export function isForKids(event: NycEvent): boolean {
  return event.categories.includes('Best for Kids')
}

const searchIndex = new WeakMap<NycEvent, string>()

function searchText(event: NycEvent): string {
  let text = searchIndex.get(event)
  if (text === undefined) {
    text = [event.title, event.description, event.park, event.location, event.borough, event.source, ...event.categories]
      .join(' ')
      .toLowerCase()
    searchIndex.set(event, text)
  }
  return text
}

export function filterEvents(events: NycEvent[], filters: Filters, clock: Clock) {
  const [start, end] = dateRange(filters.when, clock.today)
  const query = filters.query.trim().toLowerCase()
  let paidHidden = 0
  const results: ListedEvent[] = []

  for (const e of events) {
    if (e.canceled) continue
    const lastDay = e.end_date || e.start_date
    if (e.start_date > end || lastDay < start) continue
    // Drop events that already finished earlier today.
    if (lastDay === clock.today && (e.end_minutes ?? e.start_minutes ?? 24 * 60) < clock.minutes) continue
    if (filters.boroughs.length && !filters.boroughs.includes(e.borough ?? '')) continue
    if (filters.category && !e.categories.includes(filters.category)) continue
    if (filters.source && e.source !== filters.source) continue
    if (filters.kids && !isForKids(e)) continue
    if (query && !searchText(e).includes(query)) continue
    if (e.cost === 'paid') {
      paidHidden++
      continue
    }
    if (e.cost === 'donation' && !filters.donation) continue

    // Multi-day events show up on the first day of the chosen range they overlap.
    results.push({ ...e, showDate: e.start_date < start ? start : e.start_date })
  }

  results.sort((a, b) =>
    a.showDate.localeCompare(b.showDate) || (a.start_minutes ?? 0) - (b.start_minutes ?? 0))
  return { results, paidHidden }
}

// [name, count] pairs, most common first, for the dropdown menus.
export function countBy(events: NycEvent[], keys: (e: NycEvent) => string[], minCount = 1): [string, number][] {
  const counts = new Map<string, number>()
  for (const e of events) for (const key of keys(e)) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts].filter(([, n]) => n >= minCount).sort((a, b) => b[1] - a[1])
}
