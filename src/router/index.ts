import { createRouter, createWebHashHistory } from 'vue-router'
import { supabaseService } from '../api/supabaseService'

const routes = [
  {
    path: '/login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', hideLayout: true }
  },
  {
    path: '/',
    redirect: () => {
      // Logic handled in beforeEach, but here we need a placeholder
      // that does NOT match the beforeEach 'to.path === /' condition immediately
      // OR we just rely on beforeEach to intercept.
      // However, Vue Router redirect happens BEFORE navigation guards.
      // So if we redirect to /my-resume here, the guard sees /my-resume.
      
      // We should return a route that triggers the guard logic correctly.
      // But we can't easily access async user state here synchronously.
      
      // Strategy: Let it go to a loading/splash component, OR
      // Just redirect to something safe, and let the guard redirect AGAIN if needed.
      // BUT, if we redirect to /my-resume, the guard for /my-resume just checks auth.
      
      // BETTER FIX: Don't use redirect: in route config for root.
      // Use a component for root that does the logic, OR rely on the guard.
      // If we remove redirect here, the guard will catch path: '/'
      return '/dashboard-redirect' 
    }
  },
  {
      path: '/dashboard-redirect',
      component: { template: '<div>Loading...</div>' } // Dummy component
  },
  {
    path: '/admin/dashboard',
    component: () => import('../views/AdminDashboard.vue'),
    meta: { requiresAuth: true, title: '仪表盘' }
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
  }
]


const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const { data: { user } } = await supabaseService.getUser()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !user) {
    next('/login')
  } else if (to.path === '/login' && user) {
    next('/')
  } else if ((to.path === '/' || to.path === '/dashboard-redirect') && user) {
     // Handle root redirect based on role
     const { data: profile } = await supabaseService.getUserProfile(user.id)
     const role = user.user_metadata?.role || (profile ? (profile.role || profile.role_id) : 'user')
     if (role === 'admin') {
         next('/admin/dashboard')
     } else {
         next('/my-resume')
     }
  } else if (to.path.startsWith('/admin') && user) {
    // Check role
    const { data: profile } = await supabaseService.getUserProfile(user.id)
    // Also check metadata as fallback or primary if we set it there
    const role = user.user_metadata?.role || (profile ? (profile.role || profile.role_id) : 'user')
    
    if (role !== 'admin') {
       next('/my-resume')
    } else {
       next()
    }
  } else {
    next()
  }
})

export default router
