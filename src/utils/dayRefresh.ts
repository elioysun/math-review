import { getMillisecondsUntilNextDay } from '@/utils/date'

interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

interface VisibilityTargetLike extends EventTargetLike {
  visibilityState?: DocumentVisibilityState
}

export interface DayRefreshOptions {
  getDelay?: () => number
  windowTarget?: EventTargetLike
  documentTarget?: VisibilityTargetLike
}

export function createDayRefreshController(refreshToday: () => void, options: DayRefreshOptions = {}) {
  let midnightTimer: ReturnType<typeof setTimeout> | undefined

  const getDelay = options.getDelay ?? getMillisecondsUntilNextDay
  const windowTarget = options.windowTarget ?? (typeof window === 'undefined' ? undefined : window)
  const documentTarget = options.documentTarget ?? (typeof document === 'undefined' ? undefined : document)

  function clearMidnightTimer() {
    if (midnightTimer !== undefined) {
      clearTimeout(midnightTimer)
      midnightTimer = undefined
    }
  }

  function scheduleMidnightRefresh() {
    clearMidnightTimer()

    midnightTimer = setTimeout(() => {
      refreshToday()
      scheduleMidnightRefresh()
    }, getDelay())
  }

  function refreshAndSchedule() {
    refreshToday()
    scheduleMidnightRefresh()
  }

  function handleVisibilityChange() {
    if (documentTarget?.visibilityState === 'hidden') {
      return
    }

    refreshAndSchedule()
  }

  return {
    start() {
      refreshAndSchedule()
      windowTarget?.addEventListener('focus', refreshAndSchedule)
      documentTarget?.addEventListener('visibilitychange', handleVisibilityChange)
    },
    stop() {
      clearMidnightTimer()
      windowTarget?.removeEventListener('focus', refreshAndSchedule)
      documentTarget?.removeEventListener('visibilitychange', handleVisibilityChange)
    },
  }
}
