<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <h1>全部题目</h1>
        <p>查看、筛选、删除或恢复归档题。</p>
      </div>
      <span class="count-label">{{ filteredProblems.length }} / {{ store.problems.length }}</span>
    </div>

    <section class="filters">
      <label>
        <span>科目</span>
        <select v-model="filters.subject">
          <option value="">全部</option>
          <option v-for="subject in subjectOptions" :key="subject" :value="subject">
            {{ subject }}
          </option>
        </select>
      </label>
      <label>
        <span>章节</span>
        <select v-model="filters.chapter">
          <option value="">全部</option>
          <option v-for="chapter in filteredChapterOptions" :key="chapter" :value="chapter">
            {{ chapter }}
          </option>
        </select>
      </label>
      <label>
        <span>状态</span>
        <select v-model="filters.status">
          <option value="all">全部</option>
          <option value="due">待复习</option>
          <option value="scheduled">未到期</option>
          <option value="archived">已归档</option>
        </select>
      </label>
      <label>
        <span>录入日期</span>
        <input v-model="filters.createdAt" type="date" />
      </label>
    </section>

    <section class="panel">
      <div v-if="filteredProblems.length === 0" class="empty-state">没有符合条件的题目。</div>

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
                <th>状态</th>
                <th>错误</th>
                <th>连对</th>
                <th>阶段</th>
                <th>下次复习</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="problem in filteredProblems" :key="problem.id">
                <td>{{ problem.subject }}</td>
                <td>{{ problem.chapter }}</td>
                <td class="strong">{{ problem.problemId }}</td>
                <td class="muted">{{ problem.note || '—' }}</td>
                <td>{{ problem.createdAt }}</td>
                <td>
                  <span class="status-label" :class="getProblemDisplayStatus(problem)">
                    {{ getProblemDisplayStatusLabel(problem) }}
                  </span>
                </td>
                <td>{{ problem.wrongCount }}</td>
                <td>{{ problem.rightCount }}</td>
                <td>{{ problem.reviewStage }}</td>
                <td>{{ problem.dueAt }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      v-if="problem.status === 'archived'"
                      class="button small"
                      type="button"
                      @click="store.restoreProblem(problem.id)"
                    >
                      恢复
                    </button>
                    <button
                      v-else
                      class="button small"
                      type="button"
                      @click="store.archiveProblem(problem.id)"
                    >
                      归档
                    </button>
                    <button class="button danger small" type="button" @click="store.deleteProblem(problem.id)">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <ProblemCard v-for="problem in filteredProblems" :key="problem.id" :problem="problem" show-created-at>
            <template #actions>
              <button
                v-if="problem.status === 'archived'"
                class="button"
                type="button"
                @click="store.restoreProblem(problem.id)"
              >
                恢复
              </button>
              <button v-else class="button" type="button" @click="store.archiveProblem(problem.id)">
                归档
              </button>
              <button class="button danger" type="button" @click="store.deleteProblem(problem.id)">删除</button>
            </template>
          </ProblemCard>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import ProblemCard from '@/components/ProblemCard.vue'
import { getProblemDisplayStatus, getProblemDisplayStatusLabel, useProblemStore } from '@/stores/problemStore'
import type { ProblemDisplayStatus } from '@/stores/problemStore'

const store = useProblemStore()

const filters = reactive<{
  subject: string
  chapter: string
  status: 'all' | ProblemDisplayStatus
  createdAt: string
}>({
  subject: '',
  chapter: '',
  status: 'all',
  createdAt: '',
})

const subjectOptions = computed(() => store.subjectOptions)
const filteredChapterOptions = computed(() => store.chapterOptionsBySubject(filters.subject || undefined))
const filteredProblems = computed(() =>
  store.problems.filter((problem) => {
    if (filters.subject && problem.subject !== filters.subject) return false
    if (filters.chapter && problem.chapter !== filters.chapter) return false
    if (filters.status !== 'all' && getProblemDisplayStatus(problem) !== filters.status) return false
    if (filters.createdAt && problem.createdAt !== filters.createdAt) return false
    return true
  }),
)

watch(
  () => filters.subject,
  () => {
    if (filters.chapter && !filteredChapterOptions.value.includes(filters.chapter)) {
      filters.chapter = ''
    }
  },
)
</script>
