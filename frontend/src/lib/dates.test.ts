import { describe, expect, it } from 'vitest'
import { addDays, dateRange, dayLabel, nycMinutes, nycToday } from './dates'

describe('dates', () => {
  it('uses New York time, not the visitor’s time zone', () => {
    const lateNightUtc = new Date('2026-09-28T02:30:00Z') // 10:30 pm Sep 27 in New York
    expect(nycToday(lateNightUtc)).toBe('2026-09-27')
    expect(nycMinutes(lateNightUtc)).toBe(22 * 60 + 30)
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('"this weekend" is the coming Saturday and Sunday', () => {
    expect(dateRange('weekend', '2026-09-23')).toEqual(['2026-09-26', '2026-09-27']) // Wednesday
    expect(dateRange('weekend', '2026-09-26')).toEqual(['2026-09-26', '2026-09-27']) // Saturday
    expect(dateRange('weekend', '2026-09-27')).toEqual(['2026-09-27', '2026-09-27']) // Sunday
  })

  it('labels today and tomorrow', () => {
    expect(dayLabel('2026-09-27', '2026-09-27')).toBe('Today · Sunday, Sep 27')
    expect(dayLabel('2026-09-28', '2026-09-27')).toBe('Tomorrow · Monday, Sep 28')
    expect(dayLabel('2026-10-01', '2026-09-27')).toBe('Thursday, Oct 1')
  })
})
