import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STORAGE_KEY, useProblemStore } from '@/stores/problemStore'

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

function setToday(date: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${date}T09:00:00`))
}

function mountStore(date = '2026-06-09') {
  setToday(date)
  setActivePinia(createPinia())
  return useProblemStore()
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
  })

  it('adds a new problem due tomorrow with initial review fields', () => {
    const store = mountStore()

    const problem = store.addProblem({
      subject: '高数',
      chapter: '函数极限',
      problemId: '1800-12',
    })

    expect(problem.createdAt).toBe('2026-06-09')
    expect(problem.dueAt).toBe('2026-06-10')
    expect(problem.status).toBe('active')
    expect(problem.wrongCount).toBe(0)
    expect(problem.rightCount).toBe(0)
    expect(problem.reviewStage).toBe(0)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1)
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
      dueAt: '2026-06-23',
      status: 'active',
      wrongCount: 2,
      rightCount: 1,
      reviewStage: 3,
    })
  })

  it('moves a wrong answer to tomorrow and lowers stage by at most one', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '线代',
      chapter: '矩阵',
      problemId: '660-21',
    })

    problem.reviewStage = 3
    problem.rightCount = 2
    store.markWrong(problem.id)

    expect(problem.wrongCount).toBe(1)
    expect(problem.rightCount).toBe(0)
    expect(problem.reviewStage).toBe(2)
    expect(problem.dueAt).toBe('2026-06-10')

    store.markWrong(problem.id)
    store.markWrong(problem.id)

    expect(problem.reviewStage).toBe(0)
  })

  it('uses base intervals for problems that have never been wrong', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '高数',
      chapter: '导数',
      problemId: '880-1',
    })

    const expectedDueDates = [
      '2026-06-12',
      '2026-06-16',
      '2026-06-23',
      '2026-07-09',
      '2026-08-08',
      '2026-09-07',
    ]

    expectedDueDates.forEach((dueAt, index) => {
      store.markRight(problem.id)
      expect(problem.reviewStage).toBe(index + 1)
      expect(problem.dueAt).toBe(dueAt)
      expect(problem.status).toBe('active')
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
    store.markRight(oneWrong.id)
    expect(oneWrong.dueAt).toBe('2026-06-11')

    const twoWrong = store.addProblem({
      subject: '线代',
      chapter: '行列式',
      problemId: 'B',
    })
    twoWrong.wrongCount = 2
    store.markRight(twoWrong.id)
    expect(twoWrong.dueAt).toBe('2026-06-11')

    const fourWrong = store.addProblem({
      subject: '概率论',
      chapter: '随机变量',
      problemId: 'C',
    })
    fourWrong.wrongCount = 4
    store.markRight(fourWrong.id)
    expect(fourWrong.dueAt).toBe('2026-06-11')
  })

  it('archives only after passing the 90-day stage and one more right answer', () => {
    const store = mountStore()
    const problem = store.addProblem({
      subject: '英语',
      chapter: '阅读',
      problemId: 'Text-1',
    })

    for (let count = 0; count < 6; count += 1) {
      store.markRight(problem.id)
    }

    expect(problem.reviewStage).toBe(6)
    expect(problem.status).toBe('active')

    store.markRight(problem.id)

    expect(problem.reviewStage).toBe(7)
    expect(problem.status).toBe('archived')
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
      wrongCount: 0,
      rightCount: 0,
      reviewStage: 0,
    })
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
})
