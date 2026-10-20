import { fromDateTimeLocal, toDateTimeLocal } from '../format'

describe('toDateTimeLocal', () => {
  it('renders the timestamp in local time, not UTC', () => {
    const iso = '2026-10-20T00:00:00.000Z'
    const expected = (() => {
      const d = new Date(iso)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    })()
    expect(toDateTimeLocal(iso)).toBe(expected)
  })

  it('returns an empty string for a missing value', () => {
    expect(toDateTimeLocal(null)).toBe('')
    expect(toDateTimeLocal(undefined)).toBe('')
    expect(toDateTimeLocal('')).toBe('')
  })

  it('returns an empty string for an unparsable value', () => {
    expect(toDateTimeLocal('not a date')).toBe('')
  })
})

describe('fromDateTimeLocal', () => {
  it('reads the naive local string as local time', () => {
    const local = '2026-10-20T08:00'
    expect(fromDateTimeLocal(local)).toBe(new Date(local).toISOString())
  })

  it('round-trips with toDateTimeLocal', () => {
    const iso = '2026-10-20T08:00:00.000Z'
    const local = toDateTimeLocal(iso)
    const back = fromDateTimeLocal(local)
    expect(back).not.toBeNull()
    // The minute is preserved, so the round trip is stable to the minute.
    expect(toDateTimeLocal(back as string)).toBe(local)
  })

  it('returns null for an empty value', () => {
    expect(fromDateTimeLocal('')).toBeNull()
    expect(fromDateTimeLocal(null)).toBeNull()
    expect(fromDateTimeLocal(undefined)).toBeNull()
  })
})
