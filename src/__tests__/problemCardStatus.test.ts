import { describe, expect, it } from 'vitest'

import { getProblemCardStatus } from '@/components/problemCardStatus'
import type { Problem } from '@/types/problem'

function createProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'problem-card-status',
    subject: '高数',
    chapter: '第一章、函数、极限与连续',
    problemId: 'status-1',
    createdAt: '2026-06-09',
    createdAtMs: new Date(2026, 5, 9).getTime(),
    dueAt: '2026-06-10',
    status: 'active',
    wrongCount: 0,
    rightCount: 0,
    reviewStage: 0,
    ...overrides,
  }
}

describe('problem card status', () => {
  it('uses the provided today value when deriving status text', () => {
    const problem = createProblem()

    expect(getProblemCardStatus(problem, '2026-06-09')).toEqual({
      displayStatus: 'scheduled',
      statusText: '未到期',
    })
    expect(getProblemCardStatus(problem, '2026-06-10')).toEqual({
      displayStatus: 'due',
      statusText: '待复习',
    })
  })
})
