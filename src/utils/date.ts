const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDisplayDate(date: string) {
  if (!isValidDateString(date)) {
    return date
  }

  const match = DATE_PATTERN.exec(date)
  if (!match) {
    return date
  }

  const [, year, month, day] = match
  return `${year.slice(-2)}/${Number(month)}/${Number(day)}`
}

export function isValidDateString(date: string) {
  const match = DATE_PATTERN.exec(date)

  if (!match) {
    return false
  }

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))

  return (
    parsed.getFullYear() === Number(year) &&
    parsed.getMonth() === Number(month) - 1 &&
    parsed.getDate() === Number(day)
  )
}

function parseLocalDate(date: string) {
  if (!isValidDateString(date)) {
    throw new Error(`Invalid date format: ${date}`)
  }

  const match = DATE_PATTERN.exec(date)
  if (!match) {
    throw new Error(`Invalid date format: ${date}`)
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function getToday(now = new Date()) {
  return formatDate(now)
}

export function addDays(date: string, days: number) {
  const next = parseLocalDate(date)
  next.setDate(next.getDate() + days)
  return formatDate(next)
}

export function isDue(dueAt: string, today = getToday()) {
  return dueAt <= today
}

export function getMillisecondsUntilNextDay(now = new Date()) {
  const nextDay = new Date(now)
  nextDay.setHours(24, 0, 0, 0)
  return Math.max(1, nextDay.getTime() - now.getTime())
}
