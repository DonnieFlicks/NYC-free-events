// Mirrors common.make_event() in the Python backend.
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
  start_date: string // YYYY-MM-DD
  end_date: string
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

// An event as it appears in the list: multi-day events are filed under the first day in range.
export interface ListedEvent extends NycEvent {
  showDate: string
}
