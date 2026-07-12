<template>
  <section class="landing-page">
    <section class="hero-section">
      <div class="hero-copy">
        <h1>极简错题复习</h1>
        <p>一个面向数学备考的轻量级错题管理应用，把题号记录、到期复习和错题追踪放在同一个本地页面里。</p>
        <div class="hero-actions">
          <RouterLink class="button primary hero-button" to="/record">开始记录</RouterLink>
          <a class="button hero-button" href="https://github.com/elioysun/math-review" target="_blank" rel="noreferrer">
            GitHub 仓库
          </a>
        </div>
      </div>

      <div class="hero-preview" aria-label="复习流程预览">
        <div class="preview-topline">
          <span>今日看板</span>
          <strong>{{ dueProblems.length }} 题待复习</strong>
        </div>
        <div v-if="previewItems.length > 0" class="preview-list">
          <div v-for="item in previewItems" :key="item.problem.id" class="preview-item">
            <span class="preview-dot" :class="item.tone"></span>
            <div>
              <strong>{{ item.problem.problemId }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </div>
        <div v-else class="preview-empty">
          <strong>还没有记录题目</strong>
          <p>从今日记录开始建立复习节奏。</p>
        </div>
        <div class="preview-progress" :style="{ '--preview-progress': `${activeProgress}%` }">
          <span></span>
        </div>
      </div>
    </section>

    <section class="landing-section">
      <div class="landing-section__heading">
        <h2>围绕复习动作设计</h2>
        <p>不做复杂题库，只保留每天真正会用到的记录、复习和追踪。</p>
      </div>
      <div class="feature-grid">
        <article class="feature-card">
          <span class="feature-number">01</span>
          <h3>今日记录</h3>
          <p>录入题号、科目、章节和备注，当天添加的题目会在次日进入复习。</p>
        </article>
        <article class="feature-card">
          <span class="feature-number">02</span>
          <h3>间隔复习</h3>
          <p>做对后按 3、7、14、30 天推进，做错后自动回调节奏。</p>
        </article>
        <article class="feature-card">
          <span class="feature-number">03</span>
          <h3>错题追踪</h3>
          <p>持续记录错误次数、连续做对次数、当前阶段和下一次复习日期。</p>
        </article>
      </div>
    </section>

    <section class="landing-section split-section">
      <div>
        <h2>从记录到复盘的闭环</h2>
        <p>每天只需要完成两个动作：新增今天遇到的题，处理今天到期的题。历史题目可以按科目、章节和状态快速筛选。</p>
      </div>
      <ol class="flow-list">
        <li><span>1</span>当天记录题号和章节</li>
        <li><span>2</span>次日进入今日复习</li>
        <li><span>3</span>根据做对或做错推进间隔</li>
        <li><span>4</span>在全部题目中归档或回看</li>
      </ol>
    </section>

    <section class="landing-section resource-section">
      <div>
        <h2>技术栈与部署</h2>
        <p>项目基于 Vue 3、Vite、Pinia 和 Vue Router，数据保存在浏览器 localStorage 中，可部署到 GitHub Pages 或静态服务器。</p>
      </div>
      <div class="resource-actions">
        <RouterLink class="button primary" to="/record">进入应用</RouterLink>
        <a class="button" href="https://github.com/elioysun/math-review" target="_blank" rel="noreferrer">查看源码</a>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useProblemStore } from '@/stores/problemStore'
import type { Problem } from '@/types/problem'
import { formatDisplayDate } from '@/utils/date'

type PreviewTone = 'active' | 'warning' | ''

interface PreviewItem {
  problem: Problem
  description: string
  tone: PreviewTone
}

const store = useProblemStore()

const dueProblems = computed(() => store.getDueProblems())
const todayProblems = computed(() => store.getTodayProblems())
const activeProblems = computed(() => store.problems.filter((problem) => problem.status === 'active'))
const activeProgress = computed(() => {
  if (store.problems.length === 0) return 0

  return Math.round((activeProblems.value.length / store.problems.length) * 100)
})

const previewItems = computed(() => {
  const selected = new Map<string, PreviewItem>()
  const addItem = (problem: Problem, description: string, tone: PreviewTone) => {
    if (selected.size >= 3 || selected.has(problem.id)) {
      return
    }

    selected.set(problem.id, { problem, description, tone })
  }

  dueProblems.value.forEach((problem) => {
    addItem(problem, `今日到期 · ${formatProblemState(problem)}`, 'warning')
  })

  todayProblems.value.forEach((problem) => {
    addItem(problem, `今日新增 · 下次复习 ${formatDisplayDate(problem.dueAt)}`, 'active')
  })

  activeProblems.value.forEach((problem) => {
    addItem(problem, `下次复习 ${formatDisplayDate(problem.dueAt)} · ${formatProblemState(problem)}`, '')
  })

  return Array.from(selected.values())
})

function formatProblemState(problem: Problem) {
  return `${problem.subject}/${problem.chapter} · 错 ${problem.wrongCount} 次 · 连对 ${problem.rightCount} 次`
}
</script>
