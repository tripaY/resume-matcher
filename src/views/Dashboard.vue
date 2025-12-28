<template>
  <div class="dashboard-container">
    <div v-if="loading" class="loading">
        <el-skeleton :rows="3" animated />
    </div>
    <div v-else class="dashboard-content">
      <div class="welcome-header">
        <h1>欢迎回来, {{ username }}</h1>
        <el-tag :type="role === 'admin' ? 'danger' : 'success'" effect="dark">
            {{ role === 'admin' ? '管理员' : '求职者' }}
        </el-tag>
      </div>

      <div class="actions-grid">
        <!-- Admin Actions -->
        <template v-if="role === 'admin'">
          <el-card class="action-card" shadow="hover" @click="$router.push('/admin/jobs')">
            <template #header><div class="card-header"><el-icon><Briefcase /></el-icon> 岗位管理</div></template>
            <p>发布新职位，管理现有职位招聘状态。</p>
          </el-card>
          <el-card class="action-card" shadow="hover" @click="$router.push('/admin/config')">
            <template #header><div class="card-header"><el-icon><Setting /></el-icon> 系统配置</div></template>
            <p>配置行业、技能、城市等基础维度数据。</p>
          </el-card>
          <el-card class="action-card" shadow="hover" @click="$router.push('/resumes')">
            <template #header><div class="card-header"><el-icon><User /></el-icon> 人才库</div></template>
            <p>浏览候选人简历，进行人岗匹配。</p>
          </el-card>
        </template>

        <!-- User Actions -->
        <template v-else>
           <el-card class="action-card" shadow="hover" @click="$router.push('/jobs')">
            <template #header><div class="card-header"><el-icon><Search /></el-icon> 职位大厅</div></template>
            <p>浏览最新职位，查看智能匹配评分。</p>
          </el-card>
          <el-card class="action-card" shadow="hover" @click="$router.push('/my-resume')">
            <template #header><div class="card-header"><el-icon><Document /></el-icon> 我的简历</div></template>
            <p>完善个人简历，提升匹配精准度。</p>
          </el-card>
           <el-card class="action-card" shadow="hover" @click="$router.push('/candidate/matches')">
            <template #header><div class="card-header"><el-icon><Star /></el-icon> 智能推荐</div></template>
            <p>查看与您简历高度匹配的职位。</p>
          </el-card>
        </template>
        
        <el-card class="action-card logout-card" shadow="hover" @click="handleLogout">
            <template #header><div class="card-header"><el-icon><SwitchButton /></el-icon> 退出登录</div></template>
            <p>安全退出系统。</p>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { Briefcase, Setting, User, Search, Document, SwitchButton, Star } from '@element-plus/icons-vue'

const router = useRouter()
const loading = ref(true)
const username = ref('')
const role = ref('user')

onMounted(async () => {
    const { data: { user } } = await supabaseService.getUser()
    if (!user) {
        router.push('/login')
        return
    }
    
    // Get profile for role
    // Supabase Auth metadata often contains username if we put it there
    username.value = user.user_metadata?.username || user.email?.split('@')[0] || 'User'
    
    if (user.user_metadata?.role) {
        role.value = user.user_metadata.role
    }
    
    loading.value = false
})

const handleLogout = async () => {
    await supabaseService.signOut()
    router.push('/login')
}
</script>

<style scoped>
.dashboard-container {
    max-width: 1000px;
    margin: 40px auto;
    padding: 0 20px;
}

.welcome-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 40px;
}
.welcome-header h1 { margin: 0; }

.actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
}

.action-card {
    cursor: pointer;
    transition: transform 0.2s;
    height: 100%;
}
.action-card:hover {
    transform: translateY(-5px);
}

.card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: bold;
}

.logout-card {
    border-color: #fde2e2;
}
.logout-card .card-header {
    color: #f56c6c;
}
</style>