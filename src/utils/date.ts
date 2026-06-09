const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseLocalDate(date: string) {
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
