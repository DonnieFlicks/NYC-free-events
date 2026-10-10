// The one event shape the frontend understands. Mirrors frontend/src/types.ts.
export type Cost = 'free' | 'donation' | 'paid'

export interface NycEvent {
  id: string
  source: string
  title: string
  canceled: boolean
  description: string
  url: string | null
  registration_url: string | null
  park: string
  location: string
  borough: string | null
  start_date: string | null // YYYY-MM-DD
  end_date: string | null
  start_time: string | null // "8:00 am"
  end_time: string | null
  start_minutes: number | null // minutes since midnight
  end_minutes: number | null
  categories: string[]
  cost: Cost
  lat: number | null
  lng: number | null
  image: string | null
}

// Each event source is a module with a NAME and a fetch() that returns events built
// by make_event. Listed in priority order: when the same event appears in two sources,
// the earlier one wins.
export interface Source {
  NAME: string
  fetch(): Promise<NycEvent[]>
}
