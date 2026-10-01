import { useState } from 'react'
import { isForKids } from '../lib/filter'
import type { NycEvent } from '../types'

interface Props {
  event: NycEvent
  active: boolean
  onShowOnMap: (id: string) => void
}

const LONG_DESCRIPTION = 160

export function EventCard({ event: e, active, onShowOnMap }: Props) {
  const [expanded, setExpanded] = useState(false)
  const place = [e.park || e.location, e.borough].filter(Boolean).join(' · ')
  // The first line already shows the location when there's no park name, so don't repeat it.
  const locationDetail = e.park && e.location && e.location !== e.park ? e.location : null
  const pinned = e.lat != null && e.lng != null
  const directions = directionsUrl(e)

  return (
    <article className={`card${active ? ' active' : ''}`} id={`event-${e.id}`}>
      <div className="card-top">
        <span className="time">{e.start_time}</span>
        <div>
          <h3>{e.title}</h3>
          <p className="where">
            {place}
            {pinned && (
              <> · <button onClick={() => onShowOnMap(e.id)}>Show on map</button></>
            )}
            {locationDetail && <><br />{locationDetail}</>}
          </p>
        </div>
      </div>

      {e.description && <p className={`desc${expanded ? '' : ' clamped'}`}>{e.description}</p>}

      <div className="tags">
        {e.cost === 'donation' && <span className="tag note">Suggested donation</span>}
        {e.registration_url && <span className="tag note">Registration required</span>}
        {isForKids(e) && <span className="tag kids">Good for kids</span>}
        {e.categories.filter((c) => c !== 'Best for Kids').slice(0, 3).map((c) => (
          <span key={c} className="tag">{c}</span>
        ))}
        <span className="tag source">via {e.source}</span>
      </div>

      <div className="actions">
        {/* Permit listings have no event page, so point people at a web search instead. */}
        {e.url
          ? <ExternalLink href={e.url}>Details</ExternalLink>
          : <ExternalLink href={googleSearch(`${e.title} ${e.borough ?? ''} NYC`)}>Search the web</ExternalLink>}
        {e.registration_url && <ExternalLink href={e.registration_url}>Register</ExternalLink>}
        {directions && <ExternalLink href={directions}>Directions</ExternalLink>}
        {e.description.length > LONG_DESCRIPTION && (
          <button onClick={() => setExpanded(!expanded)}>{expanded ? 'Less' : 'More'}</button>
        )}
      </div>
    </article>
  )
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener">{children} ↗</a>
}

function googleSearch(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function directionsUrl(e: NycEvent): string | null {
  // Without coordinates, Google Maps can still find a street address like "Lenox Avenue between ...".
  const destination = e.lat != null && e.lng != null
    ? `${e.lat},${e.lng}`
    : e.borough && e.borough !== 'Online' ? `${e.location || e.park}, ${e.borough}, NY` : null
  return destination && `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
