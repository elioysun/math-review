import { createRouter, createWebHistory } from 'vue-router'

import ProblemsView from '@/views/ProblemsView.vue'
import RecordView from '@/views/RecordView.vue'
import ReviewView from '@/views/ReviewView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'record',
      component: RecordView,
    },
    {
      path: '/record',
      redirect: '/',
    },
    {
      path: '/review',
      name: 'review',
      component: ReviewView,
    },
    {
      path: '/problems',
      name: 'problems',
      component: ProblemsView,
    },
  ],
})

export default router
