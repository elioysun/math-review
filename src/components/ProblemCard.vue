<template>
  <article class="problem-card">
    <div class="problem-card__main">
      <div>
        <p class="problem-card__title">{{ problem.problemId }}</p>
        <p class="muted">{{ problem.subject }} · {{ problem.chapter }}</p>
      </div>
      <span class="status-label" :class="problem.status">{{ statusText }}</span>
    </div>
    <p v-if="problem.note" class="problem-card__note">{{ problem.note }}</p>
    <dl class="problem-card__meta">
      <div>
        <dt>错误</dt>
        <dd>{{ problem.wrongCount }}</dd>
      </div>
      <div>
        <dt>连对</dt>
        <dd>{{ problem.rightCount }}</dd>
      </div>
      <div>
        <dt>阶段</dt>
        <dd>{{ problem.reviewStage }}</dd>
      </div>
      <div>
        <dt>下次</dt>
        <dd>{{ problem.dueAt }}</dd>
      </div>
    </dl>
    <div v-if="$slots.actions" class="problem-card__actions">
      <slot name="actions" />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { Problem } from '@/types/problem'

const props = defineProps<{
  problem: Problem
}>()

const statusText = computed(() => (props.problem.status === 'archived' ? '已归档' : '待复习'))
</script>
