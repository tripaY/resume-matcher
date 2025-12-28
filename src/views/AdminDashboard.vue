<template>
  <div class="dashboard-container">
    <div class="page-header">
      <h2>仪表盘</h2>
      <p class="subtitle">系统概览</p>
    </div>

    <div class="dashboard-cards" v-loading="loading">
      <!-- Resumes Card -->
      <div class="dashboard-card" @click="router.push('/resumes')">
        <div class="card-icon resume-icon">
          <el-icon><User /></el-icon>
        </div>
        <div class="card-content">
          <div class="card-value">{{ resumeCount }}</div>
          <div class="card-label">简历总数</div>
        </div>
        <div class="card-arrow">
          <el-icon><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- Jobs Card -->
      <div class="dashboard-card" @click="router.push('/admin/jobs')">
        <div class="card-icon job-icon">
          <el-icon><Briefcase /></el-icon>
        </div>
        <div class="card-content">
          <div class="card-value">{{ jobCount }}</div>
          <div class="card-label">职位总数</div>
        </div>
        <div class="card-arrow">
          <el-icon><ArrowRight /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { User, Briefcase, ArrowRight } from '@element-plus/icons-vue'

const router = useRouter()
const loading = ref(true)
const resumeCount = ref(0)
const jobCount = ref(0)

onMounted(async () => {
  try {
    // Fetch counts using existing list APIs with minimal data
    const [resumesResult, jobsResult] = await Promise.all([
      supabaseService.getResumes({ limit: 1 }),
      supabaseService.getJobs({ limit: 1 })
    ])

    if (resumesResult.data) {
      resumeCount.value = resumesResult.data.total
    }
    
    if (jobsResult.data) {
      jobCount.value = jobsResult.data.total
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1f2d3d;
  margin: 0 0 8px 0;
}

.subtitle {
  color: #8492a6;
  font-size: 14px;
  margin: 0;
}

.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.dashboard-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #e0e6ed;
}

.dashboard-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  border-color: #d3dce6;
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  font-size: 24px;
}

.resume-icon {
  background-color: #ecf5ff;
  color: #409EFF;
}

.job-icon {
  background-color: #f0f9eb;
  color: #67C23A;
}

.card-content {
  flex: 1;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  color: #1f2d3d;
  line-height: 1.2;
  margin-bottom: 4px;
}

.card-label {
  font-size: 14px;
  color: #8492a6;
}

.card-arrow {
  color: #c0ccda;
  font-size: 20px;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s ease;
}

.dashboard-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(0);
}

@media (max-width: 768px) {
  .dashboard-cards {
    grid-template-columns: 1fr;
  }
}
</style>
