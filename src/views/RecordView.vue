<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <h1>今日记录</h1>
        <p>当天记题号，明天进入复习。</p>
      </div>
      <span class="count-label">{{ todayProblems.length }} 题</span>
    </div>

    <form class="entry-form" @submit.prevent="handleSubmit">
      <label>
        <span>题号</span>
        <input v-model.trim="form.problemId" autocomplete="off" required placeholder="例：660-线代-12" />
      </label>
      <label>
        <span>科目</span>
        <select v-model="form.subject">
          <option v-for="subject in subjectOptions" :key="subject" :value="subject">
            {{ subject }}
          </option>
        </select>
      </label>
      <label>
        <span>章节</span>
        <input v-model.trim="form.chapter" autocomplete="off" list="chapter-options" required :placeholder="chapterPlaceholder" />
        <datalist id="chapter-options">
          <option v-for="chapter in chapterOptions" :key="chapter" :value="chapter" />
        </datalist>
      </label>
      <label class="entry-form__note">
        <span>备注</span>
        <input v-model.trim="form.note" autocomplete="off" placeholder="可选" />
      </label>
      <button class="button primary" type="submit" :disabled="!canSubmit">添加</button>
    </form>

    <section class="panel">
      <div class="section-heading">
        <h2>今天已添加</h2>
      </div>

      <div v-if="todayProblems.length === 0" class="empty-state">今天还没有记录题目。</div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>科目</th>
              <th>章节</th>
              <th>题号</th>
              <th>备注</th>
              <th>录入日期</th>
              <th>下次复习</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="problem in todayProblems" :key="problem.id">
              <td>{{ problem.subject }}</td>
              <td>{{ problem.chapter }}</td>
              <td class="strong">{{ problem.problemId }}</td>
              <td class="muted">{{ problem.note || '—' }}</td>
              <td>{{ formatDisplayDate(problem.createdAt) }}</td>
              <td>{{ formatDisplayDate(problem.dueAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'

import { DEFAULT_SUBJECTS, useProblemStore } from '@/stores/problemStore'
import { formatDisplayDate } from '@/utils/date'

const store = useProblemStore()

const form = reactive({
  problemId: '',
  subject: DEFAULT_SUBJECTS[0],
  chapter: '',
  note: '',
})

const subjectOptions = computed(() => store.subjectOptions)
const chapterOptions = computed(() => store.chapterOptionsBySubject(form.subject))
const chapterPlaceholder = computed(() => `例：${chapterOptions.value[0] ?? '章节'}`)
const todayProblems = computed(() => store.getTodayProblems())
const canSubmit = computed(() => form.problemId.trim().length > 0 && form.chapter.trim().length > 0)

function handleSubmit() {
  if (!canSubmit.value) return

  store.addProblem({
    subject: form.subject,
    chapter: form.chapter,
    problemId: form.problemId,
    note: form.note,
  })

  form.problemId = ''
  form.chapter = ''
  form.note = ''
}
</script>
