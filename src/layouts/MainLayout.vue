<template>
  <el-container class="layout-container">
    <!-- Left Sidebar -->
      <el-aside :width="isCollapse ? '64px' : '180px'" class="aside">
        <div class="logo-wrapper" :class="{ 'collapsed': isCollapse }">
          <div class="logo-content" style="display: flex; align-items: center; justify-content: center; width: 100%; position: relative;">
            <div class="collapse-btn" @click="toggleCollapse">
                <el-icon><component :is="isCollapse ? Expand : Fold" /></el-icon>
            </div>
            <img src="https://element-plus.org/images/element-plus-logo.svg" alt="Logo" class="logo-img" style="height: 20px; filter: brightness(0) invert(1);" />
          </div>
        </div>
        
        <el-menu
          :default-active="activePath"
          class="el-menu-vertical"
          :collapse="isCollapse"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
          router
          :collapse-transition="false"
        >
          <template v-if="!loading">
            <!-- Admin Menu -->
            <template v-if="role === 'admin'">
               <el-menu-item index="/admin/dashboard">
                 <el-icon><Odometer /></el-icon>
                 <template #title>仪表盘</template>
               </el-menu-item>
               <el-menu-item index="/resumes">
                 <el-icon><User /></el-icon>
                 <template #title>人才库</template>
               </el-menu-item>
               <el-menu-item index="/admin/jobs">
                 <el-icon><Briefcase /></el-icon>
                 <template #title>职位管理</template>
               </el-menu-item>
               <el-menu-item index="/admin/config">
                 <el-icon><Setting /></el-icon>
                 <template #title>系统配置</template>
               </el-menu-item>
            </template>
            
            <!-- Candidate Menu -->
            <template v-else>
               <el-menu-item index="/my-resume">
                 <el-icon><Document /></el-icon>
                 <template #title>我的简历</template>
               </el-menu-item>
               <el-menu-item index="/jobs">
                 <el-icon><Search /></el-icon>
                 <template #title>职位大厅</template>
               </el-menu-item>
            </template>
          </template>
        </el-menu>
        
        <div class="sidebar-footer" v-if="!isCollapse">
            <div class="user-info-container">
                <span v-if="role === 'admin'" class="user-label">管理者</span>
                <span v-else class="user-label" :title="username">求职者：{{ username || '用户' }}</span>
            </div>
            <el-tooltip content="退出登录" placement="top" :show-after="500">
                <div class="logout-icon-btn" @click="handleLogout" :title="undefined">
                    <el-icon :class="{ 'is-loading': loggingOut }">
                        <Loading v-if="loggingOut" />
                        <SwitchButton v-else />
                    </el-icon>
                    <span class="logout-text" v-if="!isCollapse">退出</span>
                </div>
            </el-tooltip>
        </div>
        <div class="sidebar-footer-collapsed" v-else @click="handleLogout">
             <el-icon><SwitchButton /></el-icon>
        </div>
      </el-aside>

    <!-- Right Content -->
    <el-container>
      <!-- Header removed as per request -->
      
      <el-main class="main-content">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { 
  User, Briefcase, Setting, Search, Document, 
  SwitchButton, Expand, Fold, Loading, Odometer
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const role = ref('candidate')
const username = ref('')
const loading = ref(true)
const isCollapse = ref(false)
const loggingOut = ref(false)

onMounted(async () => {
  const { data: { user } } = await supabaseService.getUser()
  if (user) {
      // 1. Username from Auth (User Metadata)
      username.value = user.user_metadata?.username || user.email?.split('@')[0] || ''

      // 2. Role from Profile (Database Source of Truth)
      const { data: profile } = await supabaseService.getUserProfile(user.id)
      role.value = profile.role_id || 'candidate'
  }
  loading.value = false
})

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await supabaseService.signOut()
  } catch (e) {
    console.error('Logout error:', e)
  } finally {
    router.push('/login')
    loggingOut.value = false
  }
}

const activePath = computed(() => {
  if (route.path.startsWith('/resumes')) return '/resumes'
  if (route.path.startsWith('/admin/jobs')) return '/admin/jobs'
  if (route.path.startsWith('/jobs')) return '/jobs'
  return route.path
})

</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #304156;
  color: #fff;
  transition: width 0.3s;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.logo-wrapper {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2b2f3a;
  color: #fff;
  font-weight: bold;
  font-size: 16px;
  overflow: hidden;
  white-space: nowrap;
}

.collapse-btn {
  position: absolute;
  left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #409EFF;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  z-index: 10;
}

.collapse-btn:hover {
  background-color: #66b1ff;
}

/* Hide logo when collapsed to avoid overlap */
.collapsed .logo-img {
    display: none;
}

.collapsed .collapse-btn {
    left: 50%;
    transform: translateX(-50%);
}

.logo-text {
  margin-left: 10px;
}

.logo-text-collapsed {
  font-size: 18px;
  font-weight: bold;
}

.el-menu-vertical {
  border-right: none;
  flex: 1;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 180px;
}

/* Sidebar footer */
.sidebar-footer {
  height: 50px;
  border-top: 1px solid #1f2d3d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #bfcbd9;
  font-size: 13px;
  background-color: #304156;
}

.user-info-container {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-right: 8px;
}

.logout-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s;
  gap: 4px;
}

.logout-text {
    font-size: 12px;
    white-space: nowrap;
}

.logout-icon-btn:hover {
  background-color: #263445;
  color: #409EFF;
}

.sidebar-footer-collapsed {
  height: 50px;
  border-top: 1px solid #1f2d3d;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #bfcbd9;
  transition: all 0.3s;
}

.sidebar-footer-collapsed:hover {
  background-color: #263445;
  color: #409EFF;
}

/* Header styles removed as they are no longer used */

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>