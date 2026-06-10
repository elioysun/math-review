import { defineStore } from 'pinia'

import type { AddProblemInput, Problem, ProblemStatus } from '@/types/problem'
import { addDays, getToday, isDue } from '@/utils/date'

export const STORAGE_KEY = 'simple-review-problems'
export const DEFAULT_SUBJECTS = ['高数', '线代', '概率论'] as const
export const BASE_INTERVALS = [3, 7, 14, 30, 60, 90] as const
export const PROBLEM_DISPLAY_STATUS_LABELS = {
  due: '待复习',
  scheduled: '未到期',
  archived: '已归档',
} as const
export const DEFAULT_CHAPTERS_BY_SUBJECT = {
  高数: [
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
  ],
  线代: [
    '导学',
    '第一章、行列式',
    '第二章、矩阵',
    '第三章、向量',
    '第四章、方程组',
    '第五章、特征值和特征向量',
    '第六章、二次型',
  ],
  概率论: [
    '第一章、随机事件与概率',
    '第二章、一维随机变量及其分布',
    '第三章、多维随机变量及其分布',
    '第四章、随机变量的数字特征',
    '第五章、大数定律和中心极限定理',
    '第六章、数理统计的基本概念',
    '第七章、参数估计',
    '第八章、假设检验',
  ],
} as const

type StoredProblem = Partial<Problem> & Record<string, unknown>
type MathSubject = (typeof DEFAULT_SUBJECTS)[number]
type SubjectWithDefaultChapters = keyof typeof DEFAULT_CHAPTERS_BY_SUBJECT
export type ProblemDisplayStatus = keyof typeof PROBLEM_DISPLAY_STATUS_LABELS

export interface TodayReviewStats {
  total: number
  reviewed: number
  remaining: number
  progress: number
}

function canUseStorage() {
  return typeof globalThis.localStorage !== 'undefined'
}

function createProblemId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeStatus(status: unknown): ProblemStatus {
  return status === 'archived' ? 'archived' : 'active'
}

function isMathSubject(subject: string): subject is MathSubject {
  return (DEFAULT_SUBJECTS as readonly string[]).includes(subject)
}

function migrateProblem(problem: StoredProblem): Problem | null {
  if (
    typeof problem.id !== 'string' ||
    typeof problem.subject !== 'string' ||
    typeof problem.chapter !== 'string' ||
    typeof problem.problemId !== 'string' ||
    typeof problem.createdAt !== 'string' ||
    typeof problem.dueAt !== 'string'
  ) {
    return null
  }

  if (!isMathSubject(problem.subject)) {
    return null
  }

  return {
    id: problem.id,
    subject: problem.subject,
    chapter: problem.chapter,
    problemId: problem.problemId,
    note: typeof problem.note === 'string' ? problem.note : undefined,
    createdAt: problem.createdAt,
    dueAt: problem.dueAt,
    ...(typeof problem.lastReviewedAt === 'string' ? { lastReviewedAt: problem.lastReviewedAt } : {}),
    status: normalizeStatus(problem.status),
    wrongCount: typeof problem.wrongCount === 'number' ? problem.wrongCount : 0,
    rightCount: typeof problem.rightCount === 'number' ? problem.rightCount : 0,
    reviewStage: typeof problem.reviewStage === 'number' ? problem.reviewStage : 0,
  }
}

function loadProblems() {
  if (!canUseStorage()) {
    return []
  }

  const raw = globalThis.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((problem) => migrateProblem(problem as StoredProblem))
      .filter((problem): problem is Problem => problem !== null)
  } catch {
    return []
  }
}

function saveProblems(problems: Problem[]) {
  if (canUseStorage()) {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(problems))
  }
}

function hasDefaultChapters(subject: string): subject is SubjectWithDefaultChapters {
  return subject in DEFAULT_CHAPTERS_BY_SUBJECT
}

function getDefaultChapters(subject?: string) {
  if (subject && hasDefaultChapters(subject)) {
    return [...DEFAULT_CHAPTERS_BY_SUBJECT[subject]]
  }

  return Object.values(DEFAULT_CHAPTERS_BY_SUBJECT).flat()
}

function collectChapterOptions(problems: Problem[], subject?: string) {
  const chapters = new Set<string>(getDefaultChapters(subject))

  problems.forEach((problem) => {
    if (subject && problem.subject !== subject) {
      return
    }

    if (problem.chapter.trim()) {
      chapters.add(problem.chapter)
    }
  })

  return Array.from(chapters)
}

export function getWrongWeight(problem: Problem) {
  if (problem.wrongCount === 0) return 1
  if (problem.wrongCount === 1) return 0.8
  if (problem.wrongCount <= 3) return 0.6
  return 0.5
}

export function getNextIntervalAfterRight(problem: Problem) {
  const interval = BASE_INTERVALS[problem.reviewStage - 1]

  if (interval === undefined) {
    return null
  }

  return Math.max(1, Math.round(interval * getWrongWeight(problem)))
}

export function getProblemDisplayStatus(problem: Problem, today = getToday()): ProblemDisplayStatus {
  if (problem.status === 'archived') {
    return 'archived'
  }

  return isDue(problem.dueAt, today) ? 'due' : 'scheduled'
}

export function getProblemDisplayStatusLabel(problem: Problem, today = getToday()) {
  return PROBLEM_DISPLAY_STATUS_LABELS[getProblemDisplayStatus(problem, today)]
}

export function calculateTodayReviewStats(problems: Problem[], today = getToday()): TodayReviewStats {
  const reviewed = problems.filter((problem) => problem.lastReviewedAt === today).length
  const remaining = problems.filter((problem) => problem.status === 'active' && isDue(problem.dueAt, today)).length
  const total = reviewed + remaining

  return {
    total,
    reviewed,
    remaining,
    progress: total === 0 ? 100 : Math.round((reviewed / total) * 100),
  }
}

export const useProblemStore = defineStore('problemStore', {
  state: () => ({
    problems: loadProblems() as Problem[],
  }),
  getters: {
    subjectOptions() {
      return [...DEFAULT_SUBJECTS]
    },
    chapterOptions(state) {
      return collectChapterOptions(state.problems)
    },
    chapterOptionsBySubject(state) {
      return (subject?: string) => collectChapterOptions(state.problems, subject)
    },
  },
  actions: {
    save() {
      saveProblems(this.problems)
    },
    addProblem(input: AddProblemInput) {
      if (!isMathSubject(input.subject.trim())) {
        throw new Error(`Unsupported subject: ${input.subject}`)
      }

      const today = getToday()
      const problem: Problem = {
        id: createProblemId(),
        subject: input.subject.trim(),
        chapter: input.chapter.trim(),
        problemId: input.problemId.trim(),
        note: input.note?.trim() || undefined,
        createdAt: today,
        dueAt: addDays(today, 1),
        status: 'active',
        wrongCount: 0,
        rightCount: 0,
        reviewStage: 0,
      }

      this.problems.unshift(problem)
      this.save()
      return problem
    },
    markRight(id: string) {
      const problem = this.problems.find((item) => item.id === id)

      if (!problem || problem.status === 'archived') {
        return
      }

      const today = getToday()
      problem.rightCount += 1
      problem.reviewStage += 1
      problem.lastReviewedAt = today

      if (problem.reviewStage > BASE_INTERVALS.length) {
        problem.status = 'archived'
        this.save()
        return
      }

      const nextInterval = getNextIntervalAfterRight(problem)
      problem.dueAt = addDays(today, nextInterval ?? 1)
      this.save()
    },
    markWrong(id: string) {
      const problem = this.problems.find((item) => item.id === id)

      if (!problem || problem.status === 'archived') {
        return
      }

      const today = getToday()
      problem.wrongCount += 1
      problem.rightCount = 0
      problem.reviewStage = Math.max(0, problem.reviewStage - 1)
      problem.lastReviewedAt = today
      problem.dueAt = addDays(today, 1)
      this.save()
    },
    deleteProblem(id: string) {
      this.problems = this.problems.filter((problem) => problem.id !== id)
      this.save()
    },
    archiveProblem(id: string) {
      const problem = this.problems.find((item) => item.id === id)

      if (problem) {
        problem.status = 'archived'
        this.save()
      }
    },
    restoreProblem(id: string) {
      const problem = this.problems.find((item) => item.id === id)

      if (problem) {
        problem.status = 'active'
        this.save()
      }
    },
    getTodayProblems() {
      const today = getToday()
      return this.problems.filter((problem) => problem.createdAt === today)
    },
    getDueProblems() {
      return this.problems.filter((problem) => problem.status === 'active' && isDue(problem.dueAt))
    },
    getReviewedTodayProblems() {
      const today = getToday()
      return this.problems.filter((problem) => problem.lastReviewedAt === today)
    },
    getTodayReviewStats() {
      return calculateTodayReviewStats(this.problems)
    },
    getArchivedProblems() {
      return this.problems.filter((problem) => problem.status === 'archived')
    },
  },
})
