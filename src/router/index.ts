import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/resumes'
  },
  {
    path: '/resumes',
    component: () => import('../views/ResumeList.vue'),
    meta: { title: '人才库' }
  },
  {
    path: '/resumes/:id',
    component: () => import('../views/ResumeDetail.vue'),
    meta: { title: '简历详情' }
  },
  {
    path: '/jobs',
    component: () => import('../views/JobList.vue'),
    meta: { title: '职位管理' }
  },
  {
    path: '/jobs/:id',
    component: () => import('../views/JobDetail.vue'),
    meta: { title: '职位详情' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
