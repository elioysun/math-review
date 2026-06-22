<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <h1>今日复习</h1>
        <p>选择做对、做错或归档，处理今天到期的题目。</p>
      </div>
      <span class="count-label">{{ dueProblems.length }} 题</span>
    </div>

    <section class="review-status" :class="{ 'review-status--complete': reviewStats.total > 0 && reviewStats.remaining === 0 }">
      <div class="review-status__summary">
        <div>
          <span>今日复习状态</span>
          <strong>{{ reviewStatusText }}</strong>
        </div>
        <div class="review-status__percent">{{ reviewStats.progress }}%</div>
      </div>
      <div class="review-status__bar" :style="{ '--review-progress': `${reviewStats.progress}%` }">
        <span></span>
      </div>
      <dl class="review-status__meta">
        <div>
          <dt>已处理</dt>
          <dd>{{ reviewStats.reviewed }}</dd>
        </div>
        <div>
          <dt>剩余</dt>
          <dd>{{ reviewStats.remaining }}</dd>
        </div>
        <div>
          <dt>今日到期</dt>
          <dd>{{ reviewStats.total }}</dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <div v-if="dueProblems.length === 0" class="empty-state">今天没有到期题目。</div>

      <div v-else>
        <div class="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>科目</th>
                <th>章节</th>
                <th>题号</th>
                <th>备注</th>
                <th>录入日期</th>
                <th>错误次数</th>
                <th>连续做对</th>
                <th>阶段</th>
                <th>下次复习</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="problem in dueProblems" :key="problem.id">
                <td>{{ problem.subject }}</td>
                <td>{{ problem.chapter }}</td>
                <td class="strong">{{ problem.problemId }}</td>
                <td class="muted">{{ problem.note || '—' }}</td>
                <td>{{ formatDisplayDate(problem.createdAt) }}</td>
                <td>{{ problem.wrongCount }}</td>
                <td>{{ problem.rightCount }}</td>
                <td>{{ formatReviewStage(problem) }}</td>
                <td>{{ formatDisplayDate(problem.dueAt) }}</td>
                <td>
                  <div class="row-actions">
                    <button class="button primary small" type="button" @click="store.markRight(problem.id)">做对</button>
                    <button class="button danger small" type="button" @click="store.markWrong(problem.id)">做错</button>
                    <button class="button small" type="button" @click="store.archiveTodayReviewProblem(problem.id)">
                      归档
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <ProblemCard
            v-for="problem in dueProblems"
            :key="problem.id"
            :problem="problem"
            show-created-at
            :today="store.currentDate"
          >
            <template #actions>
              <button class="button primary" type="button" @click="store.markRight(problem.id)">做对</button>
              <button class="button danger" type="button" @click="store.markWrong(problem.id)">做错</button>
              <button class="button" type="button" @click="store.archiveTodayReviewProblem(problem.id)">归档</button>
            </template>
          </ProblemCard>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ProblemCard from '@/components/ProblemCard.vue'
import { formatReviewStage, useProblemStore } from '@/stores/problemStore'
import { formatDisplayDate } from '@/utils/date'

const store = useProblemStore()
const dueProblems = computed(() => store.getDueProblems())
const reviewStats = computed(() => store.getTodayReviewStats())

const reviewStatusText = computed(() => {
  if (reviewStats.value.total === 0) {
    return '今天没有到期题目'
  }

  if (reviewStats.value.remaining === 0) {
    return '今日到期题目已处理完'
  }

  if (reviewStats.value.reviewed === 0) {
    return '今日到期题目还未开始'
  }

  return `已处理 ${reviewStats.value.reviewed} 题，还剩 ${reviewStats.value.remaining} 题`
})
</script>
