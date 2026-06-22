import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDayRefreshController } from '@/utils/dayRefresh'

class FakeEventTarget {
  private listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set<() => void>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener())
  }
}

class FakeDocumentTarget extends FakeEventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
}

describe('day refresh controller', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes on start, at midnight intervals, focus, and visible changes', () => {
    vi.useFakeTimers()
    const refreshToday = vi.fn()
    const windowTarget = new FakeEventTarget()
    const documentTarget = new FakeDocumentTarget()
    const controller = createDayRefreshController(refreshToday, {
      getDelay: () => 1000,
      windowTarget,
      documentTarget,
    })

    controller.start()
    expect(refreshToday).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(refreshToday).toHaveBeenCalledTimes(2)

    windowTarget.dispatch('focus')
    expect(refreshToday).toHaveBeenCalledTimes(3)

    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatch('visibilitychange')
    expect(refreshToday).toHaveBeenCalledTimes(3)

    documentTarget.visibilityState = 'visible'
    documentTarget.dispatch('visibilitychange')
    expect(refreshToday).toHaveBeenCalledTimes(4)

    vi.advanceTimersByTime(1000)
    expect(refreshToday).toHaveBeenCalledTimes(5)

    controller.stop()
    windowTarget.dispatch('focus')
    vi.advanceTimersByTime(1000)
    expect(refreshToday).toHaveBeenCalledTimes(5)
  })
})
