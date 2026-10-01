// Dates are YYYY-MM-DD strings in New York time, wherever the visitor happens to be.
export const NYC_TZ = 'America/New_York'

export type When = 'today' | 'tomorrow' | 'weekend' | 'week' | 'all'

export function nycToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NYC_TZ }).format(now) // en-CA gives YYYY-MM-DD
}

export function nycMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NYC_TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
}

export function dateRange(when: When, today: string): [string, string] {
  switch (when) {
    case 'today':
      return [today, today]
    case 'tomorrow':
      return [addDays(today, 1), addDays(today, 1)]
    case 'weekend': {
      const day = weekday(today)
      if (day === 0) return [today, today] // Sunday: just what's left of the weekend
      const saturday = addDays(today, 6 - day)
      return [saturday, addDays(saturday, 1)]
    }
    case 'week':
      return [today, addDays(today, 6)]
    case 'all':
      return ['0000-00-00', '9999-99-99']
  }
}

export function dayLabel(date: string, today: string): string {
  const pretty = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric',
  })
  if (date === today) return `Today · ${pretty}`
  if (date === addDays(today, 1)) return `Tomorrow · ${pretty}`
  return pretty
}
