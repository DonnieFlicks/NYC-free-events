import { useEffect, useState } from 'react'
import { nycMinutes, nycToday } from './lib/dates'
import type { Clock } from './lib/filter'
import type { NycEvent } from './types'

type EventsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: NycEvent[] }

export function useEvents(): EventsState {
  const [state, setState] = useState<EventsState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/events', { signal: controller.signal })
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        return resp.json() as Promise<NycEvent[]>
      })
      .then((events) => setState({ status: 'ready', events }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error(err)
        setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [])

  return state
}

function readClock(): Clock {
  const now = new Date()
  return { today: nycToday(now), minutes: nycMinutes(now) }
}

// The current New York date and time, updated every minute so finished events drop off.
export function useNycClock(): Clock {
  const [clock, setClock] = useState(readClock)
  useEffect(() => {
    const timer = setInterval(() => setClock(readClock()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return clock
}
