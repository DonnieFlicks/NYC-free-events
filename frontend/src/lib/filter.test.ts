import { describe, expect, it } from 'vitest'
import type { NycEvent } from '../types'
import { DEFAULT_FILTERS, filterEvents, type Filters } from './filter'

const TODAY = '2026-09-27'
const NOON = { today: TODAY, minutes: 12 * 60 }

function event(overrides: Partial<NycEvent>): NycEvent {
  return {
    id: overrides.title ?? 'x', source: 'NYC Parks', title: 'Event', canceled: false, description: '',
    url: null, registration_url: null, park: '', location: '', borough: 'Manhattan',
    start_date: TODAY, end_date: TODAY, start_time: '1:00 pm', end_time: '2:00 pm',
    start_minutes: 13 * 60, end_minutes: 14 * 60, categories: [], cost: 'free',
    lat: null, lng: null, image: null, ...overrides,
  }
}

const titles = (events: NycEvent[], filters: Partial<Filters> = {}, clock = NOON) =>
  filterEvents(events, { ...DEFAULT_FILTERS, ...filters }, clock).results.map((e) => e.title)

describe('filterEvents', () => {
  it('hides paid events and counts them', () => {
    const { results, paidHidden } = filterEvents(
      [event({ title: 'Yoga' }), event({ title: 'Gala', cost: 'paid' })], DEFAULT_FILTERS, NOON)
    expect(results.map((e) => e.title)).toEqual(['Yoga'])
    expect(paidHidden).toBe(1)
  })

  it('hides canceled events and ones that already ended today', () => {
    const events = [
      event({ title: 'Canceled', canceled: true }),
      event({ title: 'Breakfast', start_minutes: 8 * 60, end_minutes: 9 * 60 }),
      event({ title: 'Lunch', start_minutes: 11 * 60, end_minutes: 13 * 60 }),
    ]
    expect(titles(events)).toEqual(['Lunch'])
  })

  it('lets people hide suggested-donation events', () => {
    const events = [event({ title: 'Museum', cost: 'donation' })]
    expect(titles(events)).toEqual(['Museum'])
    expect(titles(events, { donation: false })).toEqual([])
  })

  it('files a multi-day event under the first day of the range', () => {
    const fair = event({ title: 'Fair', start_date: '2026-09-25', end_date: '2026-09-29' })
    const [result] = filterEvents([fair], { ...DEFAULT_FILTERS, when: 'tomorrow' }, NOON).results
    expect(result.showDate).toBe('2026-09-28')
  })

  it('filters by borough, source, and kids', () => {
    const events = [
      event({ title: 'A', borough: 'Queens', categories: ['Best for Kids'] }),
      event({ title: 'B', borough: 'Bronx', source: 'Brooklyn Bridge Park' }),
    ]
    expect(titles(events, { boroughs: ['Queens'] })).toEqual(['A'])
    expect(titles(events, { source: 'Brooklyn Bridge Park' })).toEqual(['B'])
    expect(titles(events, { kids: true })).toEqual(['A'])
  })

  it('searches titles, places, and categories, ignoring case', () => {
    const events = [
      event({ title: 'Tai Chi', park: 'Riverside Park' }),
      event({ title: 'Concert', categories: ['Live Music'] }),
    ]
    expect(titles(events, { query: 'riverside' })).toEqual(['Tai Chi'])
    expect(titles(events, { query: 'MUSIC' })).toEqual(['Concert'])
  })

  it('sorts by day, then start time', () => {
    const events = [
      event({ title: 'Later', start_minutes: 18 * 60, end_minutes: 19 * 60 }),
      event({ title: 'Tomorrow', start_date: '2026-09-28', end_date: '2026-09-28', start_minutes: 9 * 60 }),
      event({ title: 'Sooner', start_minutes: 13 * 60 }),
    ]
    expect(titles(events, { when: 'all' })).toEqual(['Sooner', 'Later', 'Tomorrow'])
  })
})
