import { defineStore } from 'pinia'

import type { AddProblemInput, Problem, ProblemStatus } from '@/types/problem'
import { addDays, getToday, isDue, isValidDateString } from '@/utils/date'

export const STORAGE_KEY = 'simple-review-problems'
export const PERSISTENCE_ERROR_MESSAGE = '无法持久保存，本次修改可能只在当前页面有效'
export const EXTERNAL_STORAGE_CONFLICT_MESSAGE = '检测到其他标签页更新了数据，请刷新页面后继续操作，避免覆盖最新数据'
export const DELETE_PROBLEM_CONFIRM_MESSAGE = '确认删除这道题吗？删除后本地数据会被删除，无法恢复。'
export const IMPORT_PROBLEMS_CONFIRM_MESSAGE = '导入会覆盖当前设备上的错题数据。建议先导出当前数据作为备份，确定继续导入吗？'
export const IMPORT_PROBLEMS_ERROR_MESSAGE = '导入失败，请选择 Math Review 导出的 JSON 文件'
export const IMPORT_PROBLEMS_EMPTY_MESSAGE = '导入失败，文件中没有可用的错题数据'
export const EXPORT_BACKUP_APP = 'math-review'
export const EXPORT_BACKUP_SCHEMA = 'wrong-problems-backup'
export const EXPORT_BACKUP_VERSION = 1
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

interface LoadProblemsResult {
  problems: Problem[]
  error: string | null
  persistenceLocked: boolean
  rawValue: string | null
}

interface SafeGetItemResult {
  value: string | null
  error: string | null
}

interface SafeStorageResult {
  storage: Storage | null
  error: string | null
}

interface SaveProblemsResult {
  error: string | null
  rawValue: string | null
}

interface ImportProblemsResult {
  importedCount: number
  skippedCount: number
  error: string | null
}

interface ParsedImportProblems {
  problems: Problem[]
  skippedCount: number
  error: string | null
}

function getStorage(): SafeStorageResult {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return { storage: null, error: PERSISTENCE_ERROR_MESSAGE }
    }

    return { storage: globalThis.localStorage, error: null }
  } catch {
    return { storage: null, error: PERSISTENCE_ERROR_MESSAGE }
  }
}

export function safeGetItem(key: string): SafeGetItemResult {
  const { storage, error } = getStorage()

  if (error || !storage) {
    return { value: null, error: error ?? PERSISTENCE_ERROR_MESSAGE }
  }

  try {
    return { value: storage.getItem(key), error: null }
  } catch {
    return { value: null, error: PERSISTENCE_ERROR_MESSAGE }
  }
}

export function safeSetItem(key: string, value: string) {
  const { storage, error } = getStorage()

  if (error || !storage) {
    return error ?? PERSISTENCE_ERROR_MESSAGE
  }

  try {
    storage.setItem(key, value)
    return null
  } catch {
    return PERSISTENCE_ERROR_MESSAGE
  }
}

export function safeRemoveItem(key: string) {
  const { storage, error } = getStorage()

  if (error || !storage) {
    return error ?? PERSISTENCE_ERROR_MESSAGE
  }

  try {
    storage.removeItem(key)
    return null
  } catch {
    return PERSISTENCE_ERROR_MESSAGE
  }
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

function isRecord(value: unknown): value is StoredProblem {
  return typeof value === 'object' && value !== null
}

function normalizeDate(value: unknown, fallback: string) {
  return typeof value === 'string' && isValidDateString(value) ? value : fallback
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : fallback

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  const normalized = Math.floor(numericValue)

  if (normalized < 0) {
    return fallback
  }

  return Math.min(normalized, max)
}

function getDateStartMs(date: string) {
  if (!isValidDateString(date)) {
    return 0
  }

  const [year, month, day] = date.split('-').map(Number)
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime()
}

function getLegacyCreatedAtMs(createdAt: string, index: number, total: number) {
  return getDateStartMs(createdAt) + Math.max(0, total - index - 1)
}

function getCreatedAtMs(problem: StoredProblem, index: number, total: number) {
  if (
    (typeof problem.createdAtMs === 'number' || typeof problem.createdAtMs === 'string') &&
    Number.isFinite(Number(problem.createdAtMs)) &&
    Number(problem.createdAtMs) >= 0
  ) {
    return Math.floor(Number(problem.createdAtMs))
  }

  if (typeof problem.createdAt !== 'string') {
    return 0
  }

  return getLegacyCreatedAtMs(problem.createdAt, index, total)
}

function isMathSubject(subject: string): subject is MathSubject {
  return (DEFAULT_SUBJECTS as readonly string[]).includes(subject)
}

function migrateProblem(problem: StoredProblem, index: number, total: number): Problem | null {
  if (
    typeof problem.id !== 'string' ||
    typeof problem.subject !== 'string' ||
    typeof problem.chapter !== 'string' ||
    typeof problem.problemId !== 'string'
  ) {
    return null
  }

  if (!isMathSubject(problem.subject)) {
    return null
  }

  const createdAt = normalizeDate(problem.createdAt, getToday())
  const dueAt = normalizeDate(problem.dueAt, createdAt)
  const lastReviewedAt = normalizeDate(problem.lastReviewedAt, '')
  const status = normalizeStatus(problem.status)
  const maxReviewStage = status === 'archived' ? BASE_INTERVALS.length + 1 : BASE_INTERVALS.length
  const reviewStage = normalizeNonNegativeInteger(problem.reviewStage, 0, maxReviewStage)

  return {
    id: problem.id,
    subject: problem.subject,
    chapter: problem.chapter,
    problemId: problem.problemId,
    note: typeof problem.note === 'string' ? problem.note : undefined,
    createdAt,
    createdAtMs: getCreatedAtMs({ ...problem, createdAt }, index, total),
    dueAt,
    ...(lastReviewedAt ? { lastReviewedAt } : {}),
    status,
    wrongCount: normalizeNonNegativeInteger(problem.wrongCount),
    rightCount: normalizeNonNegativeInteger(problem.rightCount ?? problem.correctCount),
    reviewStage,
  }
}

function loadProblems(): LoadProblemsResult {
  const { value: raw, error } = safeGetItem(STORAGE_KEY)

  if (error) {
    return { problems: [], error, persistenceLocked: false, rawValue: null }
  }

  if (!raw) {
    return { problems: [], error: null, persistenceLocked: false, rawValue: raw }
  }

  try {
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return { problems: [], error: null, persistenceLocked: false, rawValue: raw }
    }

    const problems = parsed
      .map((problem, index) => {
        try {
          return isRecord(problem) ? migrateProblem(problem, index, parsed.length) : null
        } catch {
          return null
        }
      })
      .filter((problem): problem is Problem => problem !== null)

    return { problems, error: null, persistenceLocked: false, rawValue: raw }
  } catch {
    return { problems: [], error: PERSISTENCE_ERROR_MESSAGE, persistenceLocked: true, rawValue: raw }
  }
}

function getImportRecords(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return parsed
  }

  if (isRecord(parsed) && Array.isArray(parsed.problems)) {
    return parsed.problems
  }

  return null
}

function parseImportedProblems(rawData: string): ParsedImportProblems {
  try {
    const parsed = JSON.parse(rawData)
    const records = getImportRecords(parsed)

    if (!records) {
      return { problems: [], skippedCount: 0, error: IMPORT_PROBLEMS_ERROR_MESSAGE }
    }

    const problems = records
      .map((problem, index) => {
        try {
          return isRecord(problem) ? migrateProblem(problem, index, records.length) : null
        } catch {
          return null
        }
      })
      .filter((problem): problem is Problem => problem !== null)

    if (problems.length === 0) {
      return { problems: [], skippedCount: records.length, error: IMPORT_PROBLEMS_EMPTY_MESSAGE }
    }

    return {
      problems,
      skippedCount: records.length - problems.length,
      error: null,
    }
  } catch {
    return { problems: [], skippedCount: 0, error: IMPORT_PROBLEMS_ERROR_MESSAGE }
  }
}

function saveProblems(problems: Problem[]): SaveProblemsResult {
  try {
    const rawValue = JSON.stringify(problems)
    return { error: safeSetItem(STORAGE_KEY, rawValue), rawValue }
  } catch {
    return { error: PERSISTENCE_ERROR_MESSAGE, rawValue: null }
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

export function formatReviewStage(problem: Pick<Problem, 'reviewStage' | 'status'>) {
  if (problem.status === 'archived') {
    return PROBLEM_DISPLAY_STATUS_LABELS.archived
  }

  const totalStages = BASE_INTERVALS.length
  const currentStage = Math.min(Math.max(problem.reviewStage, 0), totalStages)

  if (currentStage === totalStages) {
    return `${currentStage}/${totalStages} · 待最终确认`
  }

  return `${currentStage}/${totalStages}`
}

function compareByCreatedAtAsc(first: Problem, second: Problem) {
  return first.createdAtMs - second.createdAtMs
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

export function confirmProblemDeletion(confirmFn?: (message: string) => boolean) {
  const confirm = confirmFn ?? globalThis.confirm
  return typeof confirm === 'function' ? confirm(DELETE_PROBLEM_CONFIRM_MESSAGE) : false
}

export const useProblemStore = defineStore('problemStore', {
  state: () => {
    const loaded = loadProblems()

    return {
      problems: loaded.problems as Problem[],
      currentDate: getToday(),
      persistenceError: loaded.error,
      persistenceLocked: loaded.persistenceLocked,
      lastKnownRawValue: loaded.rawValue as string | null,
    }
  },
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
    exportProblemsData() {
      return JSON.stringify(
        {
          app: EXPORT_BACKUP_APP,
          schema: EXPORT_BACKUP_SCHEMA,
          version: EXPORT_BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          problems: this.problems,
        },
        null,
        2,
      )
    },
    importProblemsData(rawData: string): ImportProblemsResult {
      const parsed = parseImportedProblems(rawData)

      if (parsed.error) {
        return { importedCount: 0, skippedCount: parsed.skippedCount, error: parsed.error }
      }

      const saved = saveProblems(parsed.problems)

      if (saved.error || saved.rawValue === null) {
        this.persistenceError = saved.error ?? PERSISTENCE_ERROR_MESSAGE
        return { importedCount: 0, skippedCount: parsed.skippedCount, error: this.persistenceError }
      }

      this.problems = parsed.problems
      this.persistenceError = null
      this.persistenceLocked = false
      this.lastKnownRawValue = saved.rawValue

      return { importedCount: parsed.problems.length, skippedCount: parsed.skippedCount, error: null }
    },
    handleExternalStorageUpdate(rawValue: string | null) {
      if (rawValue === this.lastKnownRawValue) {
        return
      }

      this.lastKnownRawValue = rawValue
      this.persistenceError = EXTERNAL_STORAGE_CONFLICT_MESSAGE
      this.persistenceLocked = true
    },
    save() {
      if (this.persistenceLocked) {
        this.persistenceError ||= PERSISTENCE_ERROR_MESSAGE
        return
      }

      const saved = saveProblems(this.problems)
      this.persistenceError = saved.error

      if (!saved.error && saved.rawValue !== null) {
        this.lastKnownRawValue = saved.rawValue
      }
    },
    refreshToday(now = new Date()) {
      this.currentDate = getToday(now)
    },
    addProblem(input: AddProblemInput) {
      if (!isMathSubject(input.subject.trim())) {
        throw new Error(`Unsupported subject: ${input.subject}`)
      }

      const now = new Date()
      const today = getToday(now)
      const problem: Problem = {
        id: createProblemId(),
        subject: input.subject.trim(),
        chapter: input.chapter.trim(),
        problemId: input.problemId.trim(),
        note: input.note?.trim() || undefined,
        createdAt: today,
        createdAtMs: now.getTime(),
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
    updateProblemNote(id: string, note: string) {
      const problem = this.problems.find((item) => item.id === id)

      if (!problem) {
        return
      }

      const nextNote = note.trim() || undefined

      if (problem.note === nextNote) {
        return
      }

      problem.note = nextNote
      this.save()
    },
    markRight(id: string) {
      const problem = this.problems.find((item) => item.id === id)
      const today = getToday()

      if (!problem || problem.status === 'archived' || !isDue(problem.dueAt, today) || problem.lastReviewedAt === today) {
        return
      }

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
      const today = getToday()

      if (!problem || problem.status === 'archived' || !isDue(problem.dueAt, today) || problem.lastReviewedAt === today) {
        return
      }

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
    archiveTodayReviewProblem(id: string) {
      const problem = this.problems.find((item) => item.id === id)
      const today = this.currentDate

      if (!problem || problem.status === 'archived' || !isDue(problem.dueAt, today) || problem.lastReviewedAt === today) {
        return
      }

      problem.status = 'archived'
      problem.lastReviewedAt = today
      this.save()
    },
    restoreProblem(id: string) {
      const problem = this.problems.find((item) => item.id === id)

      if (problem) {
        problem.status = 'active'

        if (problem.reviewStage > BASE_INTERVALS.length) {
          problem.reviewStage = BASE_INTERVALS.length
          problem.dueAt = addDays(getToday(), 1)
        }

        this.save()
      }
    },
    getTodayProblems(today?: string) {
      const reviewDate = today ?? this.currentDate
      return this.problems.filter((problem) => problem.createdAt === reviewDate)
    },
    getDueProblems(today?: string) {
      const reviewDate = today ?? this.currentDate
      return this.problems
        .filter((problem) => problem.status === 'active' && isDue(problem.dueAt, reviewDate))
        .sort(compareByCreatedAtAsc)
    },
    getReviewedTodayProblems(today?: string) {
      const reviewDate = today ?? this.currentDate
      return this.problems.filter((problem) => problem.lastReviewedAt === reviewDate)
    },
    getTodayReviewStats(today?: string) {
      return calculateTodayReviewStats(this.problems, today ?? this.currentDate)
    },
    getArchivedProblems() {
      return this.problems.filter((problem) => problem.status === 'archived')
    },
  },
})
