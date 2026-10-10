import { describe, expect, it } from 'vitest'

import { classifyCost, cleanText, makeEvent, minutesSinceMidnight, stripHtml } from './common.js'
import { dedupe } from './events.js'
import * as brooklynBridgePark from './sources/brooklynBridgePark.js'
import * as nycParks from './sources/nycParks.js'
import * as nycPermits from './sources/nycPermits.js'

// ---------- Shared cleanup ----------

describe('shared cleanup', () => {
  it('decodes entities and splits glued sentences', () => {
    expect(cleanText('Wear your colors!NYRR Open Run&nbsp;is free.')).toBe(
      'Wear your colors! NYRR Open Run is free.',
    )
  })

  it('strip_html keeps paragraph breaks as spaces', () => {
    expect(stripHtml('<p>First part.</p>\n<p>Second<br />line</p>')).toBe('First part. Second line')
  })

  it('admission price is paid', () => {
    expect(classifyCost('Admission: General Admission: $30.00')).toBe('paid')
    expect(classifyCost('Tickets: $125 per person')).toBe('paid')
    expect(classifyCost('Admission is $10 for members and $15 for non-members.')).toBe('paid')
  })

  it('suggested donation is not paid', () => {
    expect(classifyCost('Suggested donation for entry is $3, but no one is turned away.')).toBe(
      'donation',
    )
  })

  it('unrelated dollar amounts stay free', () => {
    expect(classifyCost('The park received $30 million from the Anchor Parks initiative.')).toBe(
      'free',
    )
    expect(classifyCost('Join us for a free yoga class.')).toBe('free')
  })

  it('minutes since midnight', () => {
    expect(minutesSinceMidnight('8:00 am')).toBe(480)
    expect(minutesSinceMidnight('12:30 pm')).toBe(750)
    expect(minutesSinceMidnight('12:00 am')).toBe(0)
    expect(minutesSinceMidnight('')).toBeNull()
  })

  it('flags canceled events from the title', () => {
    const event = (title: string) => makeEvent({ source: 'Test', id: '1', title, start_date: '2026-10-01' })
    expect(event('CANCELED: Kids In Motion').canceled).toBe(true)
    expect(event('Cancelled: Tai Chi').canceled).toBe(true)
    expect(event('Tai Chi').canceled).toBe(false)
  })

  it('dedupe keeps the first copy of an event', () => {
    const first = makeEvent({ source: 'A', id: '1', title: 'Sunset Yoga!', start_date: '2026-10-06', start_time: '5:30 pm' })
    const copy = makeEvent({ source: 'B', id: '9', title: 'Sunset yoga', start_date: '2026-10-06', start_time: '5:30 pm' })
    const otherDay = makeEvent({ source: 'B', id: '10', title: 'Sunset yoga', start_date: '2026-10-13', start_time: '5:30 pm' })
    expect(dedupe([first, copy, otherDay])).toEqual([first, otherDay])
  })
})

// ---------- NYC Parks ----------

describe('NYC Parks', () => {
  it('borough from park id or place name', () => {
    expect(nycParks.guessBorough({ parkids: 'M072' })).toBe('Manhattan')
    expect(nycParks.guessBorough({ parkids: 'x012' })).toBe('Bronx')
    expect(nycParks.guessBorough({ parkids: '', location: 'Queens Public Library - Corona' })).toBe('Queens')
    expect(nycParks.guessBorough({ parkids: '', location: 'Virtual/Online Events' })).toBe('Online')
    expect(nycParks.guessBorough({ parkids: '', location: 'Sunnyside Community Services' })).toBeNull()
  })

  it('missing borough comes from nearest event', () => {
    const events = [
      { borough: 'Brooklyn', lat: 40.67, lng: -73.97 },
      { borough: 'Staten Island', lat: 40.58, lng: -74.15 },
      { borough: null, lat: 40.66, lng: -73.91 },
    ]
    nycParks.fillMissingBoroughs(events)
    expect(events[2]!.borough).toBe('Brooklyn')
  })
})

// ---------- NYC Event Permits ----------

describe('NYC Event Permits', () => {
  it('street location is tidied', () => {
    const [place, street] = nycPermits.splitLocation(
      'LENOX AVENUE between WEST  136 STREET and WEST  137 STREET, LENOX AVENUE between WEST 137 STREET',
    )
    expect(place).toBe('')
    expect(street).toBe('Lenox Avenue between West 136 Street and West 137 Street')
  })

  it('named place is split out', () => {
    const [place] = nycPermits.splitLocation(
      'Times Square: 45/46 Broadway Pedestrian Plaza (Times Sq) BROADWAY',
    )
    expect(place).toBe('Times Square')
  })

  it('row becomes event', () => {
    const event = nycPermits.toEvent({
      event_id: '123',
      event_name: 'CENTRAL PARK PRECINCT COMMUNITY BLOCK PARTY',
      event_type: 'Single Block Festival',
      event_borough: 'Manhattan',
      start_date_time: '2026-09-27T10:00:00.000',
      end_date_time: '2026-09-27T18:00:00.000',
      event_location: 'EAST   60 STREET between 5 AVENUE and MADISON AVENUE',
    })
    expect(event.title).toBe('Central Park Precinct Community Block Party')
    expect([event.start_date, event.start_time, event.end_time]).toEqual(['2026-09-27', '10:00 am', '6:00 pm'])
    expect(event.location).toBe('East 60 Street between 5 Avenue and Madison Avenue')
    expect(event.categories).toEqual(['Festivals'])
  })

  it('ids are unique across days of one permit', () => {
    const row = {
      event_id: '899826',
      event_name: 'Afterschool Fun',
      event_type: 'Open Street Partner Event',
      event_borough: 'Queens',
      event_location: '34 AVENUE between 93 STREET and 94 STREET',
    }
    const monday = nycPermits.toEvent({ ...row, start_date_time: '2026-09-28T08:00:00.000' })
    const tuesday = nycPermits.toEvent({ ...row, start_date_time: '2026-09-29T08:00:00.000' })
    expect(monday.id).not.toBe(tuesday.id)
  })
})

// ---------- Brooklyn Bridge Park ----------

describe('Brooklyn Bridge Park', () => {
  it('post becomes event with location coordinates', () => {
    const post = {
      id: 56639,
      link: 'https://brooklynbridgepark.org/event/stargazing/',
      title: { rendered: 'Stargazing &#8211; October 14' },
      event_category: [347],
      acf: {
        status: 'Scheduled',
        date: '20261014',
        start_time: '7:30 pm',
        end_time: '9:30 pm',
        'multi-day': false,
        description: '<p>Look up!</p>',
        event_location: [18685],
      },
    }
    const locations = { 18685: { name: 'Pier 1', latitude: '40.7026', longitude: '-73.9967' } }
    const event = brooklynBridgePark.toEvent(post, locations, { 347: 'Education' })
    expect(event.title).toBe('Stargazing – October 14')
    expect([event.start_date, event.end_date]).toEqual(['2026-10-14', '2026-10-14'])
    expect([event.location, event.lat, event.lng]).toEqual(['Pier 1', 40.7026, -73.9967])
    expect(event.categories).toEqual(['Education'])
    expect(event.canceled).toBe(false)
  })

  it('cancelled status is respected', () => {
    const post = {
      id: 1,
      title: { rendered: 'Zumba' },
      acf: { status: 'Cancelled', date: '20261005', event_location: [] },
    }
    const event = brooklynBridgePark.toEvent(post, {}, {})
    expect(event.canceled).toBe(true)
    expect(event.lat).toBeNull()
  })
})
