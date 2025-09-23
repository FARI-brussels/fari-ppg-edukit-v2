import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import InteractiveView from '../views/InteractiveView.vue'

const mode = import.meta.env.MODE
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/interactive',
      name: 'interactive',
      component: InteractiveView,
    },
  ],
})

export default router
