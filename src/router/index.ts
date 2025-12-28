import { createRouter, createWebHashHistory } from 'vue-router'
import { supabaseService } from '../api/supabaseService'

const routes = [
  {
    path: '/login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    redirect: '/dashboard' // Changed from /resumes to a dashboard or role-based logic
  },
  {
    path: '/dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true, title: '工作台' }
  },
  {
    path: '/admin/jobs',
    component: () => import('../views/AdminJobs.vue'),
    meta: { requiresAuth: true, title: '岗位管理' }
  },
  {
    path: '/admin/config',
    component: () => import('../views/AdminConfig.vue'),
    meta: { requiresAuth: true, title: '系统配置' }
  },
  {
    path: '/resumes',
    component: () => import('../views/ResumeList.vue'),
    meta: { requiresAuth: true, title: '人才库' }
  },
  {
    path: '/resumes/:id',
    component: () => import('../views/ResumeDetail.vue'),
    meta: { requiresAuth: true, title: '简历详情' }
  },
  {
    path: '/jobs',
    component: () => import('../views/JobList.vue'),
    meta: { requiresAuth: true, title: '职位管理' }
  },
  {
    path: '/jobs/:id',
    component: () => import('../views/JobDetail.vue'),
    meta: { requiresAuth: true, title: '职位详情' }
  },
  {
    path: '/my-resume',
    component: () => import('../views/ResumeDetail.vue'), // Reuse ResumeDetail for editing own
    meta: { requiresAuth: true, title: '我的简历' }
  },
  {
    path: '/candidate/matches',
    component: () => import('../views/CandidateMatches.vue'),
    meta: { requiresAuth: true, title: '职位匹配' }
  },
  {
    path: '/debug/llm',
    component: () => import('../views/TestLLM.vue'),
    meta: { title: 'LLM Debugger' }
  }
]


const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const { data: { user } } = await supabaseService.getUser()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !user) {
    next('/login')
  } else if (to.path === '/login' && user) {
    next('/')
  } else if (to.path.startsWith('/admin') && user) {
    // Check role
    const { data: profile } = await supabaseService.getUserProfile(user.id)
    // Also check metadata as fallback or primary if we set it there
    const role = user.user_metadata?.role || (profile ? profile.role : 'user')
    
    if (role !== 'admin') {
       next('/dashboard')
    } else {
       next()
    }
  } else {
    next()
  }
})

export default router
