<template>
  <div class="app-shell">
    <AppNav />
    <main class="page-shell">
      <p v-if="store.persistenceError" class="persistence-warning" role="alert">{{ store.persistenceError }}</p>
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'

import AppNav from '@/components/AppNav.vue'
import { STORAGE_KEY, useProblemStore } from '@/stores/problemStore'
import { createDayRefreshController } from '@/utils/dayRefresh'

const store = useProblemStore()
const dayRefreshController = createDayRefreshController(() => store.refreshToday())

function handleStorageEvent(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) {
    store.handleExternalStorageUpdate(event.newValue)
  }
}

onMounted(() => {
  dayRefreshController.start()
  window.addEventListener('storage', handleStorageEvent)
})

onUnmounted(() => {
  dayRefreshController.stop()
  window.removeEventListener('storage', handleStorageEvent)
})
</script>
