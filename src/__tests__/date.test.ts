import { describe, expect, it } from 'vitest'

import { addDays, formatDisplayDate, getMillisecondsUntilNextDay, getToday, isDue, isValidDateString } from '@/utils/date'

describe('date utilities', () => {
  it('formats the current local date as YYYY-MM-DD', () => {
    expect(getToday(new Date(2026, 5, 9, 8, 30))).toBe('2026-06-09')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('formats valid stored dates for display without changing invalid values', () => {
    expect(formatDisplayDate('2026-06-09')).toBe('26/6/9')
    expect(formatDisplayDate('2026-12-31')).toBe('26/12/31')
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date')
  })

  it('rejects dates that match the shape but are not real calendar days', () => {
    expect(isValidDateString('2026-06-09')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(() => addDays('2026-02-30', 1)).toThrow('Invalid date format')
  })

  it('checks whether a date is due using string-safe date format', () => {
    expect(isDue('2026-06-08', '2026-06-09')).toBe(true)
    expect(isDue('2026-06-09', '2026-06-09')).toBe(true)
    expect(isDue('2026-06-10', '2026-06-09')).toBe(false)
  })

  it('calculates the one-shot delay until the next local day', () => {
    expect(getMillisecondsUntilNextDay(new Date(2026, 5, 9, 12, 0, 0, 0))).toBe(12 * 60 * 60 * 1000)
    expect(getMillisecondsUntilNextDay(new Date(2026, 5, 9, 23, 59, 59, 0))).toBe(1000)
  })
})
