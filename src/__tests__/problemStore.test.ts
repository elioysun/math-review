import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BASE_INTERVALS,
  calculateTodayReviewStats,
  confirmProblemDeletion,
  DELETE_PROBLEM_CONFIRM_MESSAGE,
  EXTERNAL_STORAGE_CONFLICT_MESSAGE,
  formatReviewStage,
  getProblemDisplayStatus,
  getProblemDisplayStatusLabel,
  PERSISTENCE_ERROR_MESSAGE,
  STORAGE_KEY,
  useProblemStore,
} from '@/stores/problemStore'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

class ThrowingGetStorage extends MemoryStorage {
  override getItem(_key: string) {
    throw new Error('getItem blocked')
  }
}

class ThrowingSetStorage extends MemoryStorage {
  override setItem(_key: string, _value: string) {
    throw new Error('setItem blocked')
  }
}

function setToday(date: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${date}T09:00:00`))
}

function mountStore(date = '2026-06-09') {
  setToday(date)
  setActivePinia(createPinia())
  return useProblemStore()
}

function moveToDate(date: string) {
  vi.setSystemTime(new Date(`${date}T09:00:00`))
}

describe('problem store', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('adds a new problem due tomorrow with initial review fields', () => {
    const store = mountStore()

    const problem = store.addProblem({
      subject: '高数',
      chapter: '函数极限',
      problemId: '1800-12',
    })

    expect(problem.createdAt).toBe('2026-06-09')
    expect(problem.createdAtMs).toBe(new Date('2026-06-09T09:00:00').getTime())
    expect(problem.dueAt).toBe('2026-06-10')
    expect(problem.status).toBe('active')
    expect(problem.wrongCount).toBe(0)
    expect(problem.rightCount).toBe(0)
    expect(problem.reviewStage).toBe(0)
    const storedProblems = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(storedProblems).toHaveLength(1)
    expect(storedProblems[0].createdAtMs).toBe(problem.createdAtMs)
  })

  it('restores the complete problem data after the app store is created again', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: '1800-12',
      note: '本地持久化验证',
    })

    problem.wrongCount = 2
    problem.rightCount = 1
    problem.reviewStage = 3
    problem.dueAt = '2026-06-23'
    problem.lastReviewedAt = '2026-06-16'
    store.save()

    const reloadedStore = mountStore()

    expect(reloadedStore.problems).toHaveLength(1)
    expect(reloadedStore.problems[0]).toEqual({
      id: problem.id,
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: '1800-12',
      note: '本地持久化验证',
      createdAt: '2026-06-09',
      createdAtMs: problem.createdAtMs,
      dueAt: '2026-06-23',
      lastReviewedAt: '2026-06-16',
      status: 'active',
      wrongCount: 2,
      rightCount: 1,
      reviewStage: 3,
    })
  })

  it('keeps the store usable when localStorage.getItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new ThrowingGetStorage(),
      configurable: true,
    })

    const store = mountStore()

    expect(store.problems).toEqual([])
    expect(store.persistenceError).toBe(PERSISTENCE_ERROR_MESSAGE)
  })

  it('keeps add and edit flows usable when localStorage.setItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new ThrowingSetStorage(),
      configurable: true,
    })
    const store = mountStore()

    expect(() => {
      store.addProblem({
        subject: '高数',
        chapter: '第一章、函数、极限与连续',
        problemId: 'set-fail',
      })
    }).not.toThrow()

    const problem = store.problems[0]

    expect(problem.problemId).toBe('set-fail')
    expect(store.persistenceError).toBe(PERSISTENCE_ERROR_MESSAGE)

    expect(() => {
      store.updateProblemNote(problem.id, '  仍然更新内存  ')
    }).not.toThrow()

    expect(problem.note).toBe('仍然更新内存')
    expect(store.persistenceError).toBe(PERSISTENCE_ERROR_MESSAGE)
  })

  it('locks persistence after malformed localStorage JSON and keeps the raw value unchanged', () => {
    const malformed = '[{"id":'
    localStorage.setItem(STORAGE_KEY, malformed)
    const store = mountStore()

    expect(store.problems).toEqual([])
    expect(store.persistenceError).toBe(PERSISTENCE_ERROR_MESSAGE)
    expect(store.persistenceLocked).toBe(true)

    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'locked-json',
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(malformed)

    store.updateProblemNote(problem.id, '锁定时只改内存')
    expect(problem.note).toBe('锁定时只改内存')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(malformed)

    problem.dueAt = '2026-06-09'
    store.markRight(problem.id)
    expect(problem.rightCount).toBe(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(malformed)

    store.archiveProblem(problem.id)
    expect(problem.status).toBe('archived')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(malformed)

    store.deleteProblem(problem.id)
    expect(store.problems).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(malformed)
  })

  it('treats non-array localStorage JSON as empty data without locking persistence', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unsupported: true }))
    const store = mountStore()

    expect(store.problems).toEqual([])
    expect(store.persistenceError).toBeNull()
    expect(store.persistenceLocked).toBe(false)

    store.addProblem({
      subject: '线代',
      chapter: '第二章、矩阵',
      problemId: 'non-array-reset',
    })

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1)
  })

  it('locks saving after an external storage update and keeps the external raw value', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'local-problem',
    })
    const externalRaw = JSON.stringify([
      {
        id: 'external-problem',
        subject: '线代',
        chapter: '第二章、矩阵',
        problemId: 'external',
        createdAt: '2026-06-09',
        createdAtMs: 0,
        dueAt: '2026-06-10',
        status: 'active',
        wrongCount: 0,
        rightCount: 0,
        reviewStage: 0,
      },
    ])

    localStorage.setItem(STORAGE_KEY, externalRaw)
    store.handleExternalStorageUpdate(externalRaw)

    expect(store.persistenceError).toBe(EXTERNAL_STORAGE_CONFLICT_MESSAGE)
    expect(store.persistenceLocked).toBe(true)

    store.updateProblemNote(problem.id, '本地未覆盖外部数据')

    expect(problem.note).toBe('本地未覆盖外部数据')
    expect(store.persistenceError).toBe(EXTERNAL_STORAGE_CONFLICT_MESSAGE)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(externalRaw)
  })

  it('locks saving after external storage is cleared', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'clear-conflict',
    })

    localStorage.clear()
    store.handleExternalStorageUpdate(null)

    expect(store.persistenceError).toBe(EXTERNAL_STORAGE_CONFLICT_MESSAGE)
    expect(store.persistenceLocked).toBe(true)

    store.updateProblemNote(problem.id, '不应重新写回已清空的 storage')

    expect(problem.note).toBe('不应重新写回已清空的 storage')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns due problems by oldest created timestamp without mutating store order', () => {
    const store = mountStore('2026-06-10')
    const firstProblem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: '先录入',
    })

    vi.advanceTimersByTime(10)

    const secondProblem = store.addProblem({
      subject: '线代',
      chapter: '第二章、矩阵',
      problemId: '后录入',
    })

    vi.advanceTimersByTime(10)

    const thirdProblem = store.addProblem({
      subject: '概率论',
      chapter: '第三章、多维随机变量及其分布',
      problemId: '最后录入',
    })

    ;[firstProblem, secondProblem, thirdProblem].forEach((problem) => {
      problem.dueAt = '2026-06-10'
    })

    expect(store.problems.map((problem) => problem.problemId)).toEqual(['最后录入', '后录入', '先录入'])
    expect(store.getDueProblems().map((problem) => problem.problemId)).toEqual(['先录入', '后录入', '最后录入'])
    expect(store.problems.map((problem) => problem.problemId)).toEqual(['最后录入', '后录入', '先录入'])
  })

  it('refreshes due problems and review stats when the current date crosses midnight', () => {
    const store = mountStore('2026-06-09')
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'midnight-refresh',
    })

    expect(problem.dueAt).toBe('2026-06-10')
    expect(store.currentDate).toBe('2026-06-09')
    expect(store.getDueProblems()).toEqual([])
    expect(store.getTodayReviewStats()).toEqual({
      total: 0,
      reviewed: 0,
      remaining: 0,
      progress: 100,
    })

    vi.setSystemTime(new Date('2026-06-10T00:00:00'))
    store.refreshToday()

    expect(store.currentDate).toBe('2026-06-10')
    expect(store.getDueProblems().map((item) => item.id)).toEqual([problem.id])
    expect(store.getTodayReviewStats()).toEqual({
      total: 1,
      reviewed: 0,
      remaining: 1,
      progress: 0,
    })
  })

  it('requires delete confirmation and keeps data when the user cancels', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '线代',
      chapter: '第二章、矩阵',
      problemId: 'delete-cancel',
    })
    const confirm = vi.fn(() => false)

    if (confirmProblemDeletion(confirm)) {
      store.deleteProblem(problem.id)
    }

    expect(confirm).toHaveBeenCalledWith(DELETE_PROBLEM_CONFIRM_MESSAGE)
    expect(DELETE_PROBLEM_CONFIRM_MESSAGE).toContain('本地数据会被删除')
    expect(store.problems.map((item) => item.id)).toEqual([problem.id])
  })

  it('updates a problem note in memory and localStorage without changing review fields', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: '1800-12',
      note: '旧备注',
    })

    problem.wrongCount = 2
    problem.rightCount = 1
    problem.reviewStage = 3
    problem.dueAt = '2026-06-23'
    store.archiveProblem(problem.id)

    store.updateProblemNote(problem.id, '  新备注  ')

    expect(problem.note).toBe('新备注')
    expect(problem).toMatchObject({
      dueAt: '2026-06-23',
      status: 'archived',
      wrongCount: 2,
      rightCount: 1,
      reviewStage: 3,
    })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0].note).toBe('新备注')
  })

  it('clears a problem note when the new note is blank', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '线代',
      chapter: '第二章、矩阵',
      problemId: '660-21',
      note: '可清除',
    })

    store.updateProblemNote(problem.id, '   ')

    expect(problem.note).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0]).not.toHaveProperty('note')
  })

  it('ignores note updates for missing problems', () => {
    const store = mountStore()
    store.addProblem({
      subject: '概率论',
      chapter: '第三章、多维随机变量及其分布',
      problemId: 'missing-note-id',
      note: '原备注',
    })
    const problemsSnapshot = JSON.stringify(store.problems)
    const storageSnapshot = localStorage.getItem(STORAGE_KEY)

    store.updateProblemNote('missing-id', '不会保存')

    expect(JSON.stringify(store.problems)).toBe(problemsSnapshot)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storageSnapshot)
  })

  it('ignores right and wrong answers before the problem is due', () => {
    const store = mountStore('2026-06-09')
    const rightProblem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'future-right',
    })
    const wrongProblem = store.addProblem({
      subject: '线代',
      chapter: '第二章、矩阵',
      problemId: 'future-wrong',
    })
    const storageSnapshot = localStorage.getItem(STORAGE_KEY)

    store.markRight(rightProblem.id)
    store.markWrong(wrongProblem.id)

    expect(rightProblem).toMatchObject({
      dueAt: '2026-06-10',
      wrongCount: 0,
      rightCount: 0,
      reviewStage: 0,
    })
    expect(rightProblem.lastReviewedAt).toBeUndefined()
    expect(wrongProblem).toMatchObject({
      dueAt: '2026-06-10',
      wrongCount: 0,
      rightCount: 0,
      reviewStage: 0,
    })
    expect(wrongProblem.lastReviewedAt).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storageSnapshot)
  })

  it('ignores same-day repeated right answers after the first success', () => {
    const store = mountStore('2026-06-10')
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'repeat-right',
    })

    problem.dueAt = '2026-06-10'
    store.markRight(problem.id)

    const reviewedState = {
      dueAt: problem.dueAt,
      rightCount: problem.rightCount,
      reviewStage: problem.reviewStage,
      lastReviewedAt: problem.lastReviewedAt,
    }

    store.markRight(problem.id)

    expect({
      dueAt: problem.dueAt,
      rightCount: problem.rightCount,
      reviewStage: problem.reviewStage,
      lastReviewedAt: problem.lastReviewedAt,
    }).toEqual(reviewedState)
  })

  it('moves a wrong answer to tomorrow and ignores same-day repeats', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: '660-21',
    })

    problem.reviewStage = 3
    problem.rightCount = 2
    problem.dueAt = '2026-06-09'
    store.markWrong(problem.id)

    expect(problem.wrongCount).toBe(1)
    expect(problem.rightCount).toBe(0)
    expect(problem.reviewStage).toBe(2)
    expect(problem.lastReviewedAt).toBe('2026-06-09')
    expect(problem.dueAt).toBe('2026-06-10')

    store.markWrong(problem.id)
    store.markWrong(problem.id)

    expect(problem.wrongCount).toBe(1)
    expect(problem.reviewStage).toBe(2)
  })

  it('uses compressed base intervals ending at 30 days for problems that have never been wrong', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '高数',
      chapter: '导数',
      problemId: '880-1',
    })

    expect(BASE_INTERVALS).toEqual([3, 7, 14, 30])

    const expectedDueDates = ['2026-06-13', '2026-06-20', '2026-07-04', '2026-08-03']

    expectedDueDates.forEach((dueAt, index) => {
      moveToDate(problem.dueAt)
      store.markRight(problem.id)
      expect(problem.reviewStage).toBe(index + 1)
      expect(problem.dueAt).toBe(dueAt)
      expect(problem.status).toBe('active')
    })
  })

  it('derives display status from archive state and due date', () => {
    const store = mountStore('2026-06-10')
    const dueProblem = store.addProblem({
      subject: '高数',
      chapter: '极限',
      problemId: 'due-1',
    })
    dueProblem.dueAt = '2026-06-10'

    const scheduledProblem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: 'scheduled-1',
    })
    scheduledProblem.dueAt = '2026-06-11'

    const archivedProblem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'archived-1',
    })
    store.archiveProblem(archivedProblem.id)

    expect(getProblemDisplayStatus(dueProblem)).toBe('due')
    expect(getProblemDisplayStatusLabel(dueProblem)).toBe('待复习')
    expect(getProblemDisplayStatus(scheduledProblem)).toBe('scheduled')
    expect(getProblemDisplayStatusLabel(scheduledProblem)).toBe('未到期')
    expect(getProblemDisplayStatus(archivedProblem)).toBe('archived')
    expect(getProblemDisplayStatusLabel(archivedProblem)).toBe('已归档')
  })

  it('shows a right answer scheduled for the future as not due', () => {
    const store = mountStore('2026-06-10')
    const problem = store.addProblem({
      subject: '高数',
      chapter: '导数',
      problemId: 'right-1',
    })

    problem.dueAt = '2026-06-10'
    store.markRight(problem.id)

    expect(problem.dueAt).toBe('2026-06-13')
    expect(getProblemDisplayStatus(problem)).toBe('scheduled')
    expect(getProblemDisplayStatusLabel(problem)).toBe('未到期')
  })

  it('tracks today review progress after right and wrong answers', () => {
    const store = mountStore('2026-06-10')
    const firstProblem = store.addProblem({
      subject: '高数',
      chapter: '极限',
      problemId: 'today-1',
    })
    const secondProblem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: 'today-2',
    })

    firstProblem.dueAt = '2026-06-10'
    secondProblem.dueAt = '2026-06-10'

    expect(store.getTodayReviewStats()).toEqual({
      total: 2,
      reviewed: 0,
      remaining: 2,
      progress: 0,
    })

    store.markRight(firstProblem.id)

    expect(firstProblem.lastReviewedAt).toBe('2026-06-10')
    expect(store.getTodayReviewStats()).toEqual({
      total: 2,
      reviewed: 1,
      remaining: 1,
      progress: 50,
    })

    store.markWrong(secondProblem.id)

    expect(secondProblem.lastReviewedAt).toBe('2026-06-10')
    expect(store.getTodayReviewStats()).toEqual({
      total: 2,
      reviewed: 2,
      remaining: 0,
      progress: 100,
    })
  })

  it('archives a due today problem as reviewed without changing review fields', () => {
    const store = mountStore('2026-06-10')
    const archivedProblem = store.addProblem({
      subject: '高数',
      chapter: '极限',
      problemId: 'archive-today',
    })
    const remainingProblem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: 'still-due-after-archive',
    })

    archivedProblem.dueAt = '2026-06-10'
    archivedProblem.wrongCount = 3
    archivedProblem.rightCount = 2
    archivedProblem.reviewStage = 4
    remainingProblem.dueAt = '2026-06-10'

    store.archiveTodayReviewProblem(archivedProblem.id)

    expect(archivedProblem).toMatchObject({
      status: 'archived',
      lastReviewedAt: '2026-06-10',
      dueAt: '2026-06-10',
      wrongCount: 3,
      rightCount: 2,
      reviewStage: 4,
    })
    expect(store.getDueProblems().map((problem) => problem.id)).toEqual([remainingProblem.id])
    expect(store.getTodayReviewStats()).toEqual({
      total: 2,
      reviewed: 1,
      remaining: 1,
      progress: 50,
    })
  })

  it('counts right, wrong, and today archive actions as completed review work', () => {
    const store = mountStore('2026-06-10')
    const rightProblem = store.addProblem({
      subject: '高数',
      chapter: '极限',
      problemId: 'complete-right',
    })
    const wrongProblem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: 'complete-wrong',
    })
    const archivedProblem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'complete-archive',
    })

    ;[rightProblem, wrongProblem, archivedProblem].forEach((problem) => {
      problem.dueAt = '2026-06-10'
    })

    store.markRight(rightProblem.id)
    store.markWrong(wrongProblem.id)
    store.archiveTodayReviewProblem(archivedProblem.id)

    expect(store.getTodayReviewStats()).toEqual({
      total: 3,
      reviewed: 3,
      remaining: 0,
      progress: 100,
    })
  })

  it('ignores today archive actions for future, archived, already reviewed, and missing problems', () => {
    const store = mountStore('2026-06-10')
    const futureProblem = store.addProblem({
      subject: '高数',
      chapter: '极限',
      problemId: 'future-archive-ignore',
    })
    const archivedProblem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: 'archived-archive-ignore',
    })
    const reviewedProblem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'reviewed-archive-ignore',
    })

    futureProblem.dueAt = '2026-06-11'
    archivedProblem.dueAt = '2026-06-10'
    archivedProblem.status = 'archived'
    reviewedProblem.dueAt = '2026-06-10'
    reviewedProblem.lastReviewedAt = '2026-06-10'
    store.save()

    const problemsSnapshot = JSON.stringify(store.problems)
    const storageSnapshot = localStorage.getItem(STORAGE_KEY)

    store.archiveTodayReviewProblem(futureProblem.id)
    store.archiveTodayReviewProblem(archivedProblem.id)
    store.archiveTodayReviewProblem(reviewedProblem.id)
    store.archiveTodayReviewProblem('missing-today-archive-id')

    expect(JSON.stringify(store.problems)).toBe(problemsSnapshot)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storageSnapshot)
  })

  it('derives review progress from persisted review dates', () => {
    const reviewedToday = {
      id: 'reviewed-today',
      subject: '高数',
      chapter: '极限',
      problemId: '已复习',
      createdAt: '2026-06-08',
      dueAt: '2026-06-13',
      lastReviewedAt: '2026-06-10',
      status: 'active',
      wrongCount: 0,
      rightCount: 1,
      reviewStage: 1,
    }
    const stillDue = {
      id: 'still-due',
      subject: '线代',
      chapter: '矩阵',
      problemId: '待复习',
      createdAt: '2026-06-08',
      dueAt: '2026-06-10',
      status: 'active',
      wrongCount: 0,
      rightCount: 0,
      reviewStage: 0,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify([reviewedToday, stillDue]))

    const store = mountStore('2026-06-10')

    expect(store.problems[0].lastReviewedAt).toBe('2026-06-10')
    expect(calculateTodayReviewStats(store.problems)).toEqual({
      total: 2,
      reviewed: 1,
      remaining: 1,
      progress: 50,
    })
  })

  it('shortens right-answer intervals by wrong-count weight', () => {
    const store = mountStore()

    const oneWrong = store.addProblem({
      subject: '高数',
      chapter: '积分',
      problemId: 'A',
    })
    oneWrong.wrongCount = 1
    oneWrong.dueAt = '2026-06-09'
    store.markRight(oneWrong.id)
    expect(oneWrong.dueAt).toBe('2026-06-11')

    const twoWrong = store.addProblem({
      subject: '线代',
      chapter: '行列式',
      problemId: 'B',
    })
    twoWrong.wrongCount = 2
    twoWrong.dueAt = '2026-06-09'
    store.markRight(twoWrong.id)
    expect(twoWrong.dueAt).toBe('2026-06-11')

    const fourWrong = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'C',
    })
    fourWrong.wrongCount = 4
    fourWrong.dueAt = '2026-06-09'
    store.markRight(fourWrong.id)
    expect(fourWrong.dueAt).toBe('2026-06-11')
  })

  it('archives after the final review scheduled with a 30-day interval', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: '概率-1',
    })

    for (let count = 0; count < BASE_INTERVALS.length; count += 1) {
      moveToDate(problem.dueAt)
      store.markRight(problem.id)
    }

    expect(problem.reviewStage).toBe(4)
    expect(problem.status).toBe('active')

    moveToDate(problem.dueAt)
    store.markRight(problem.id)

    expect(problem.reviewStage).toBe(5)
    expect(problem.status).toBe('archived')
  })

  it('restores an auto-archived problem at the final stage due tomorrow', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'restore-auto-archived',
    })

    problem.wrongCount = 2

    for (let count = 0; count < BASE_INTERVALS.length + 1; count += 1) {
      moveToDate(problem.dueAt)
      store.markRight(problem.id)
    }

    const lastReviewedAt = problem.lastReviewedAt
    const rightCount = problem.rightCount

    expect(problem.reviewStage).toBe(BASE_INTERVALS.length + 1)
    expect(problem.status).toBe('archived')

    moveToDate('2027-01-05')
    store.restoreProblem(problem.id)

    expect(problem.status).toBe('active')
    expect(problem.reviewStage).toBe(BASE_INTERVALS.length)
    expect(problem.dueAt).toBe('2027-01-06')
    expect(problem.wrongCount).toBe(2)
    expect(problem.rightCount).toBe(rightCount)
    expect(problem.lastReviewedAt).toBe(lastReviewedAt)
  })

  it('restores an auto-archived problem after reload at the final stage due tomorrow', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'restore-after-reload',
    })

    for (let count = 0; count < BASE_INTERVALS.length + 1; count += 1) {
      moveToDate(problem.dueAt)
      store.markRight(problem.id)
    }

    const lastReviewedAt = problem.lastReviewedAt
    const rightCount = problem.rightCount

    expect(problem.reviewStage).toBe(BASE_INTERVALS.length + 1)
    expect(problem.status).toBe('archived')

    const reloadedStore = mountStore('2027-01-05')
    const reloadedProblem = reloadedStore.problems.find((item) => item.id === problem.id)

    expect(reloadedProblem).toBeDefined()
    expect(reloadedProblem?.reviewStage).toBe(BASE_INTERVALS.length + 1)
    expect(reloadedProblem?.status).toBe('archived')

    reloadedStore.restoreProblem(problem.id)

    expect(reloadedProblem?.status).toBe('active')
    expect(reloadedProblem?.reviewStage).toBe(BASE_INTERVALS.length)
    expect(reloadedProblem?.dueAt).toBe('2027-01-06')
    expect(reloadedProblem?.rightCount).toBe(rightCount)
    expect(reloadedProblem?.lastReviewedAt).toBe(lastReviewedAt)
  })

  it('formats review stages as current stage over total stages', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: '阶段显示',
    })

    expect(formatReviewStage(problem)).toBe('0/4')

    moveToDate(problem.dueAt)
    store.markRight(problem.id)

    expect(formatReviewStage(problem)).toBe('1/4')

    for (let count = 1; count < BASE_INTERVALS.length; count += 1) {
      moveToDate(problem.dueAt)
      store.markRight(problem.id)
    }

    expect(problem.reviewStage).toBe(4)
    expect(problem.status).toBe('active')
    expect(formatReviewStage(problem)).toBe('4/4 · 待最终确认')

    moveToDate(problem.dueAt)
    store.markRight(problem.id)

    expect(problem.reviewStage).toBe(5)
    expect(problem.status).toBe('archived')
    expect(formatReviewStage(problem)).toBe('已归档')
    expect(formatReviewStage(problem)).not.toBe('5/4')
  })

  it('caps legacy active 60/90-day stages to a final 30-day review', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-long-interval',
          subject: '高数',
          chapter: '极限',
          problemId: 'legacy-60',
          createdAt: '2026-05-01',
          createdAtMs: 1,
          dueAt: '2026-08-30',
          lastReviewedAt: '2026-07-01',
          status: 'active',
          wrongCount: 0,
          rightCount: 5,
          reviewStage: 5,
        },
      ]),
    )

    const store = mountStore('2026-07-12')

    expect(store.problems[0]?.reviewStage).toBe(4)
    expect(store.problems[0]?.dueAt).toBe('2026-07-31')
  })

  it('caps a legacy long interval from today when the last review date is missing', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-missing-review-date',
          subject: '线代',
          chapter: '矩阵',
          problemId: 'legacy-90',
          createdAt: '2026-05-01',
          createdAtMs: 1,
          dueAt: '2026-11-01',
          status: 'active',
          wrongCount: 4,
          rightCount: 6,
          reviewStage: 6,
        },
      ]),
    )

    const store = mountStore('2026-07-12')

    expect(store.problems[0]?.reviewStage).toBe(4)
    expect(store.problems[0]?.dueAt).toBe('2026-07-27')
  })

  it('migrates old localStorage data with missing counters and reviewStage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-1',
          subject: '高数',
          chapter: '极限',
          problemId: '旧题',
          createdAt: '2026-06-08',
          dueAt: '2026-06-09',
          status: 'active',
        },
      ]),
    )

    const store = mountStore()

    expect(store.problems[0]).toMatchObject({
      id: 'legacy-1',
      createdAtMs: new Date(2026, 5, 8).getTime(),
      wrongCount: 0,
      rightCount: 0,
      reviewStage: 0,
    })
  })

  it('normalizes invalid legacy dates, counters, and review stage without dropping valid rows', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        null,
        {
          id: 'legacy-bad-fields',
          subject: '高数',
          chapter: '极限',
          problemId: '坏字段旧题',
          createdAt: '2026-02-30',
          createdAtMs: -100,
          dueAt: 'not-a-date',
          lastReviewedAt: '2026-13-01',
          status: 'active',
          wrongCount: -3,
          rightCount: -2,
          reviewStage: 99,
          interval: -10,
          reviewCount: -4,
        },
      ]),
    )

    const store = mountStore('2026-06-09')

    expect(store.problems).toHaveLength(1)
    expect(store.problems[0]).toMatchObject({
      id: 'legacy-bad-fields',
      createdAt: '2026-06-09',
      createdAtMs: new Date(2026, 5, 9).getTime(),
      dueAt: '2026-06-09',
      wrongCount: 0,
      rightCount: 0,
      reviewStage: BASE_INTERVALS.length,
    })
    expect(store.problems[0].lastReviewedAt).toBeUndefined()
  })

  it('backfills legacy created timestamps from date and storage order', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-latest',
          subject: '高数',
          chapter: '极限',
          problemId: '最后录入',
          createdAt: '2026-06-08',
          dueAt: '2026-06-10',
          status: 'active',
        },
        {
          id: 'legacy-middle',
          subject: '线代',
          chapter: '矩阵',
          problemId: '中间录入',
          createdAt: '2026-06-08',
          dueAt: '2026-06-10',
          status: 'active',
        },
        {
          id: 'legacy-oldest',
          subject: '概率论',
          chapter: '随机变量',
          problemId: '最先录入',
          createdAt: '2026-06-08',
          dueAt: '2026-06-10',
          status: 'active',
        },
      ]),
    )

    const store = mountStore('2026-06-10')
    const dayStartMs = new Date(2026, 5, 8).getTime()

    expect(store.problems.map((problem) => problem.createdAtMs)).toEqual([dayStartMs + 2, dayStartMs + 1, dayStartMs])
    expect(store.getDueProblems().map((problem) => problem.problemId)).toEqual(['最先录入', '中间录入', '最后录入'])
  })

  it('provides default chapter options from the math screenshots by subject', () => {
    const store = mountStore()

    expect(store.chapterOptionsBySubject('高数')).toEqual([
      '第一章、函数、极限与连续',
      '第二章、一元函数微分学',
      '第三章、一元函数积分学',
      '第四章、常微分方程',
      '第五章、多元函数微分学',
      '第六章、二重积分',
      '第七章、无穷级数',
      '第八章、向量代数与空间解析几何',
      '第九章、三重积分',
      '第十章、曲线曲面积分',
    ])
    expect(store.chapterOptionsBySubject('线代')).toContain('第五章、特征值和特征向量')
    expect(store.chapterOptionsBySubject('概率论')).toContain('第八章、假设检验')
  })

  it('filters non-math subjects from legacy localStorage data', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-math',
          subject: '高数',
          chapter: '极限',
          problemId: '数学题',
          createdAt: '2026-06-08',
          dueAt: '2026-06-09',
          status: 'active',
        },
        {
          id: 'legacy-non-math',
          subject: '物理',
          chapter: '力学',
          problemId: 'Physics-1',
          createdAt: '2026-06-08',
          dueAt: '2026-06-09',
          status: 'active',
        },
      ]),
    )

    const store = mountStore()

    expect(store.problems).toHaveLength(1)
    expect(store.problems[0].subject).toBe('高数')
    expect(store.subjectOptions).toEqual(['高数', '线代', '概率论'])
  })

  it('exports current problems as a versioned migration backup', () => {
    const store = mountStore('2026-06-09')
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'export-1',
      note: '跨设备迁移',
    })

    problem.dueAt = '2026-06-12'
    problem.wrongCount = 2
    store.save()

    const backup = JSON.parse(store.exportProblemsData())

    expect(backup).toMatchObject({
      app: 'math-review',
      schema: 'wrong-problems-backup',
      version: 1,
      exportedAt: '2026-06-09T01:00:00.000Z',
    })
    expect(backup.problems).toEqual([store.problems[0]])
  })

  it('imports a backup by replacing local data with normalized valid problems', () => {
    const store = mountStore('2026-06-09')
    store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'will-be-replaced',
    })
    const backup = JSON.stringify({
      app: 'math-review',
      schema: 'wrong-problems-backup',
      version: 1,
      exportedAt: '2026-06-10T00:00:00.000Z',
      problems: [
        {
          id: 'imported-1',
          subject: '线代',
          chapter: '第二章、矩阵',
          problemId: 'import-1',
          createdAt: '2026-06-08',
          dueAt: '2026-06-10',
          status: 'active',
          wrongCount: '3',
          correctCount: '2',
          reviewStage: '4',
        },
        {
          id: 'invalid-subject',
          subject: '物理',
          chapter: '力学',
          problemId: 'skip-me',
          createdAt: '2026-06-08',
          dueAt: '2026-06-10',
          status: 'active',
        },
      ],
    })

    const result = store.importProblemsData(backup)

    expect(result).toEqual({ importedCount: 1, skippedCount: 1, error: null })
    expect(store.problems).toHaveLength(1)
    expect(store.problems[0]).toMatchObject({
      id: 'imported-1',
      subject: '线代',
      problemId: 'import-1',
      wrongCount: 3,
      rightCount: 2,
      reviewStage: 4,
    })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(store.problems)
  })

  it('uses import to recover from malformed localStorage data after explicit user replacement', () => {
    localStorage.setItem(STORAGE_KEY, '[{"id":')
    const store = mountStore('2026-06-09')
    const backup = JSON.stringify([
      {
        id: 'recover-1',
        subject: '概率论',
        chapter: '第三章、多维随机变量及其分布',
        problemId: 'recover',
        createdAt: '2026-06-08',
        dueAt: '2026-06-10',
        status: 'active',
      },
    ])

    expect(store.persistenceLocked).toBe(true)

    const result = store.importProblemsData(backup)

    expect(result).toEqual({ importedCount: 1, skippedCount: 0, error: null })
    expect(store.persistenceError).toBeNull()
    expect(store.persistenceLocked).toBe(false)
    expect(store.problems[0].id).toBe('recover-1')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0].id).toBe('recover-1')
  })

  it('keeps current data unchanged when imported JSON is invalid', () => {
    const store = mountStore('2026-06-09')
    const problem = store.addProblem({
      subject: '高数',
      chapter: '第一章、函数、极限与连续',
      problemId: 'keep-current',
    })
    const storageSnapshot = localStorage.getItem(STORAGE_KEY)

    const result = store.importProblemsData('not-json')

    expect(result.error).toContain('导入失败')
    expect(store.problems.map((item) => item.id)).toEqual([problem.id])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storageSnapshot)
  })
})
