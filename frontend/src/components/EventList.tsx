import { Fragment, useEffect } from 'react'
import { dayLabel } from '../lib/dates'
import type { ListedEvent } from '../types'
import { EventCard } from './EventCard'

interface Props {
  results: ListedEvent[]
  limit: number
  today: string
  activeId: string | null
  scrollRequest: number // bumps each time the active card should be scrolled into view
  onMore: () => void
  onShowOnMap: (id: string) => void
}

export function EventList({ results, limit, today, activeId, scrollRequest, onMore, onShowOnMap }: Props) {
  // Only scroll when asked to (a map popup link), not every time the active card changes.
  useEffect(() => {
    if (scrollRequest && activeId) {
      document.getElementById(`event-${activeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [scrollRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!results.length) {
    return <div className="empty">Nothing matches those filters. Try a different day or borough.</div>
  }

  const shown = results.slice(0, limit)
  return (
    <>
      {shown.map((event, i) => (
        <Fragment key={event.id}>
          {event.showDate !== shown[i - 1]?.showDate && (
            <h2 className="day-heading">{dayLabel(event.showDate, today)}</h2>
          )}
          <EventCard event={event} active={event.id === activeId} onShowOnMap={onShowOnMap} />
        </Fragment>
      ))}
      {results.length > limit && (
        <button className="more" onClick={onMore}>Show more ({results.length - limit} left)</button>
      )}
    </>
  )
}
