export type ProblemStatus = 'active' | 'archived'

export interface Problem {
  id: string
  subject: string
  chapter: string
  problemId: string
  note?: string
  createdAt: string
  createdAtMs: number
  dueAt: string
  lastReviewedAt?: string
  status: ProblemStatus
  wrongCount: number
  rightCount: number
  reviewStage: number
}

export interface AddProblemInput {
  subject: string
  chapter: string
  problemId: string
  note?: string
}
