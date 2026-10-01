import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { EventList } from './components/EventList'
import { EventMap } from './components/EventMap'
import { FilterBar } from './components/FilterBar'
import { useEvents, useNycClock } from './hooks'
import { countBy, DEFAULT_FILTERS, filterEvents, type Filters } from './lib/filter'
import type { NycEvent } from './types'

const PAGE_SIZE = 60
const NO_EVENTS: NycEvent[] = []

type View = 'list' | 'map'

export default function App() {
  const eventsState = useEvents()
  const events = eventsState.status === 'ready' ? eventsState.events : NO_EVENTS
  const clock = useNycClock()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [view, setView] = useState<View>('list') // only matters on phones
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mapFocus, setMapFocus] = useState<{ id: string; request: number } | null>(null)
  const [scrollRequest, setScrollRequest] = useState(0)
  const [fitRequest, setFitRequest] = useState(0)

  // Let typing stay snappy; the list catches up a moment later.
  const query = useDeferredValue(filters.query)
  const { results, paidHidden } = useMemo(
    () => filterEvents(events, { ...filters, query }, clock),
    [events, filters, query, clock],
  )
  const categories = useMemo(() => countBy(events, (e) => e.categories, 5), [events])
  const sources = useMemo(() => countBy(events, (e) => [e.source]), [events])
  const unpinned = results.filter((e) => e.lat == null && e.borough !== 'Online').length

  const updateFilters = (patch: Partial<Filters>, { refitMap = false } = {}) => {
    setFilters((f) => ({ ...f, ...patch }))
    setLimit(PAGE_SIZE)
    if (refitMap) setFitRequest((n) => n + 1)
  }

  const showOnMap = (id: string) => {
    setView('map')
    setActiveId(id)
    setMapFocus({ id, request: Date.now() })
  }

  const jumpToCard = (id: string) => {
    // The card might be past the "Show more" cutoff; extend the list so it's rendered.
    const index = results.findIndex((e) => e.id === id)
    if (index === -1) return
    setLimit((l) => Math.max(l, index + 1))
    setView('list')
    setActiveId(id)
    setScrollRequest((n) => n + 1)
  }

  // Keep the sticky map just below the sticky filter bar.
  const filterBar = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = filterBar.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <header className="site-header">
        <h1>Free in NYC</h1>
        <p>Free events in parks, plazas, and on the streets across the five boroughs.</p>
      </header>

      <FilterBar ref={filterBar} filters={filters} categories={categories} sources={sources} onChange={updateFilters} />

      <div className="view-switch" role="group" aria-label="View">
        <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        <button aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
      </div>

      <main className="layout" data-view={view}>
        <section className="results">
          <p className="summary">
            {eventsState.status === 'loading' && 'Loading events…'}
            {eventsState.status === 'error' &&
              "Couldn't load events right now. Please try again in a minute."}
            {eventsState.status === 'ready' && summaryText(results.length, unpinned, paidHidden)}
          </p>
          {eventsState.status === 'ready' && (
            <EventList
              results={results}
              limit={limit}
              today={clock.today}
              activeId={activeId}
              scrollRequest={scrollRequest}
              onMore={() => setLimit((l) => l + PAGE_SIZE)}
              onShowOnMap={showOnMap}
            />
          )}
        </section>
        <aside className="map-wrap">
          <EventMap
            results={results}
            today={clock.today}
            focus={mapFocus}
            fitRequest={fitRequest}
            visible={view === 'map'}
            onJump={jumpToCard}
          />
        </aside>
      </main>

      <footer className="site-footer">
        Event data from <a href="https://www.nycgovparks.org/events" target="_blank" rel="noopener">NYC Parks</a>,{' '}
        <a href="https://brooklynbridgepark.org/events/" target="_blank" rel="noopener">Brooklyn Bridge Park</a>, and{' '}
        <a
          href="https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tvpp-9vvx"
          target="_blank"
          rel="noopener"
        >
          NYC's permitted events
        </a>
        . Always check the details before heading out.
      </footer>
    </>
  )
}

function summaryText(count: number, unpinned: number, paidHidden: number): string {
  let text = `${count.toLocaleString()} ${count === 1 ? 'free event' : 'free events'}`
  if (unpinned) text += ` · ${unpinned} not on the map`
  if (paidHidden) text += ` · ${paidHidden} hidden because they charge admission`
  return text
}
