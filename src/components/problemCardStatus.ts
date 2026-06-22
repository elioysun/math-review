import { getProblemDisplayStatus, getProblemDisplayStatusLabel } from '@/stores/problemStore'
import type { Problem } from '@/types/problem'

export function getProblemCardStatus(problem: Problem, today?: string) {
  const displayStatus = getProblemDisplayStatus(problem, today)

  return {
    displayStatus,
    statusText: getProblemDisplayStatusLabel(problem, today),
  }
}
