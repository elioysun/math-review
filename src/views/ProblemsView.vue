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

    <section class="panel migration-panel" aria-labelledby="migration-heading">
      <div class="section-heading migration-heading">
        <div>
          <h2 id="migration-heading">数据迁移</h2>
          <p>导出 JSON 备份，在另一台设备导入后继续复习。</p>
        </div>
        <div class="migration-actions">
          <button class="button" type="button" :disabled="store.problems.length === 0" @click="handleExportProblems">
            导出错题
          </button>
          <button class="button primary" type="button" :disabled="isImporting" @click="openImportDialog">
            {{ isImporting ? '导入中' : '导入错题' }}
          </button>
        </div>
      </div>
      <div class="migration-body">
        <p class="migration-note">导入会覆盖当前设备上的错题数据，建议先导出当前数据作为备份。</p>
        <p v-if="migrationMessage" class="migration-feedback migration-feedback--success" role="status">
          {{ migrationMessage }}
        </p>
        <p v-if="migrationError" class="migration-feedback migration-feedback--error" role="alert">
          {{ migrationError }}
        </p>
        <input
          ref="importFileInput"
          class="visually-hidden"
          type="file"
          accept=".json,application/json"
          @change="handleImportProblems"
        />
      </div>
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
                <td>
                  <input
                    class="note-input"
                    :value="problem.note ?? ''"
                    aria-label="备注"
                    autocomplete="off"
                    placeholder="—"
                    @change="handleNoteBlur(problem.id, $event)"
                    @focusout="handleNoteBlur(problem.id, $event)"
                  />
                </td>
                <td>{{ formatDisplayDate(problem.createdAt) }}</td>
                <td>
                  <span class="status-label" :class="getProblemDisplayStatus(problem, store.currentDate)">
                    {{ getProblemDisplayStatusLabel(problem, store.currentDate) }}
                  </span>
                </td>
                <td>{{ problem.wrongCount }}</td>
                <td>{{ problem.rightCount }}</td>
                <td>{{ formatReviewStage(problem) }}</td>
                <td>{{ formatDisplayDate(problem.dueAt) }}</td>
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
                    <button class="button danger small" type="button" @click="handleDeleteProblem(problem.id)">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          <ProblemCard
            v-for="problem in filteredProblems"
            :key="problem.id"
            :problem="problem"
            editable-note
            show-created-at
            :today="store.currentDate"
            @update-note="store.updateProblemNote"
          >
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
              <button class="button danger" type="button" @click="handleDeleteProblem(problem.id)">删除</button>
            </template>
          </ProblemCard>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import ProblemCard from '@/components/ProblemCard.vue'
import {
  confirmProblemDeletion,
  formatReviewStage,
  getProblemDisplayStatus,
  getProblemDisplayStatusLabel,
  IMPORT_PROBLEMS_CONFIRM_MESSAGE,
  IMPORT_PROBLEMS_ERROR_MESSAGE,
  useProblemStore,
} from '@/stores/problemStore'
import type { ProblemDisplayStatus } from '@/stores/problemStore'
import { formatDisplayDate } from '@/utils/date'

const store = useProblemStore()
const importFileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const migrationMessage = ref('')
const migrationError = ref('')

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
    if (filters.status !== 'all' && getProblemDisplayStatus(problem, store.currentDate) !== filters.status) return false
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

function handleNoteBlur(id: string, event: Event) {
  const target = event.target

  if (target && 'value' in target) {
    store.updateProblemNote(id, String(target.value))
  }
}

function handleDeleteProblem(id: string) {
  if (!confirmProblemDeletion()) {
    return
  }

  store.deleteProblem(id)
}

function resetMigrationFeedback() {
  migrationMessage.value = ''
  migrationError.value = ''
}

function getExportFileName() {
  return `math-review-wrong-problems-${store.currentDate}.json`
}

function handleExportProblems() {
  resetMigrationFeedback()

  const blob = new Blob([store.exportProblemsData()], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = getExportFileName()
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)

  migrationMessage.value = `已导出 ${store.problems.length} 道错题`
}

function openImportDialog() {
  resetMigrationFeedback()

  if (
    store.problems.length > 0 &&
    typeof globalThis.confirm === 'function' &&
    !globalThis.confirm(IMPORT_PROBLEMS_CONFIRM_MESSAGE)
  ) {
    return
  }

  if (importFileInput.value) {
    importFileInput.value.value = ''
    importFileInput.value.click()
  }
}

async function handleImportProblems(event: Event) {
  const target = event.target

  if (!(target instanceof HTMLInputElement) || !target.files?.[0]) {
    return
  }

  isImporting.value = true
  resetMigrationFeedback()

  try {
    const result = store.importProblemsData(await target.files[0].text())

    if (result.error) {
      migrationError.value = result.error
      return
    }

    const skippedText = result.skippedCount > 0 ? `，跳过 ${result.skippedCount} 条不可用记录` : ''
    migrationMessage.value = `已导入 ${result.importedCount} 道错题${skippedText}`
  } catch {
    migrationError.value = IMPORT_PROBLEMS_ERROR_MESSAGE
  } finally {
    isImporting.value = false
    target.value = ''
  }
}
</script>
