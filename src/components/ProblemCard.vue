<template>
  <article class="problem-card">
    <div class="problem-card__main">
      <div>
        <p class="problem-card__title">{{ problem.problemId }}</p>
        <p class="muted">{{ problem.subject }} · {{ problem.chapter }}</p>
      </div>
      <span class="status-label" :class="displayStatus">{{ statusText }}</span>
    </div>
    <p v-if="problem.note" class="problem-card__note">{{ problem.note }}</p>
    <dl class="problem-card__meta" :class="{ 'problem-card__meta--with-created-at': showCreatedAt }">
      <div v-if="showCreatedAt">
        <dt>录入</dt>
        <dd>{{ problem.createdAt }}</dd>
      </div>
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

import { getProblemDisplayStatus, getProblemDisplayStatusLabel } from '@/stores/problemStore'
import type { Problem } from '@/types/problem'

const props = defineProps<{
  problem: Problem
  showCreatedAt?: boolean
}>()

const displayStatus = computed(() => getProblemDisplayStatus(props.problem))
const statusText = computed(() => getProblemDisplayStatusLabel(props.problem))
</script>
