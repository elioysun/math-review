import { describe, expect, it } from 'vitest'

import { addDays, getToday, isDue } from '@/utils/date'

describe('date utilities', () => {
  it('formats the current local date as YYYY-MM-DD', () => {
    expect(getToday(new Date(2026, 5, 9, 8, 30))).toBe('2026-06-09')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('checks whether a date is due using string-safe date format', () => {
    expect(isDue('2026-06-08', '2026-06-09')).toBe(true)
    expect(isDue('2026-06-09', '2026-06-09')).toBe(true)
    expect(isDue('2026-06-10', '2026-06-09')).toBe(false)
  })
})
