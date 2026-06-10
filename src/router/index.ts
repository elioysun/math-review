import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import ProblemsView from '@/views/ProblemsView.vue'
import RecordView from '@/views/RecordView.vue'
import ReviewView from '@/views/ReviewView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/record',
      name: 'record',
      component: RecordView,
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
