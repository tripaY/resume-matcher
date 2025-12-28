<template>
  <div class="page-container">
    <div class="header">
      <h2>职位匹配推荐</h2>
      <el-button type="primary" :loading="matching" @click="runMatching">重新计算匹配</el-button>
    </div>
    
    <el-table :data="matches" style="width: 100%" v-loading="loading">
      <el-table-column label="匹配度" width="100" sortable prop="score">
        <template #default="{ row }">
          <el-progress type="circle" :percentage="row.score" :width="50" :status="getScoreStatus(row.score)" />
        </template>
      </el-table-column>
      <el-table-column prop="job.title" label="职位名称" width="200" />
      <el-table-column prop="job.city" label="城市" width="100" />
      <el-table-column prop="job.salary_range" label="薪资范围" width="150" />
      <el-table-column label="匹配分析">
        <template #default="{ row }">
          <div v-for="(reason, idx) in row.reasons" :key="idx" class="reason-item">
            • {{ reason }}
          </div>
          <div v-if="!row.reasons || row.reasons.length === 0" class="no-reason">
             暂无详细分析
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/jobs/${row.job.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabaseService } from '../api/supabaseService'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const matching = ref(false)
const matches = ref<any[]>([])

const getScoreStatus = (score: number) => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'exception'
}

const loadMatches = async () => {
  loading.value = true
  const { data: { user } } = await supabaseService.getUser()
  if (!user) return

  // 1. Get My Resume ID
  const { data: resume } = await supabaseService.getMyResume(user.id)
  if (!resume) {
    ElMessage.warning('请先完善您的简历')
    loading.value = false
    return
  }

  // 2. Get Matches
  const { data, error } = await supabaseService.getResumeMatches(resume.id)
  if (error) {
    ElMessage.error('获取匹配失败')
  } else {
    matches.value = data
  }
  loading.value = false
}

const runMatching = async () => {
  matching.value = true
  try {
      const { data: { user } } = await supabaseService.getUser()
      if (!user) return
      
      const { data: resume } = await supabaseService.getMyResume(user.id)
      if (!resume) {
          ElMessage.warning('请先完善简历')
          return
      }

      // 1. Get all jobs
      // Ideally this should be done on backend, but we do it here for now as requested
      const { data: jobsData } = await supabaseService.getJobs(1, 100, {}) // Limit to 100 for now
      const jobs = jobsData.items

      // 2. Run match for each job
      let successCount = 0
      for (const job of jobs) {
          const { error } = await supabaseService.runMatch(resume.id, job.id)
          if (!error) successCount++
      }
      
      ElMessage.success(`匹配计算完成，成功匹配 ${successCount} 个职位`)
      loadMatches()
  } catch (e) {
      console.error(e)
      ElMessage.error('匹配计算出错')
  } finally {
      matching.value = false
  }
}

const getScoreStatus = (score: number) => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'exception'
}

onMounted(() => {
  loadMatches()
})
</script>

<style scoped>
.page-container {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.reason-item {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
}
.no-reason {
    font-size: 12px;
    color: #999;
    font-style: italic;
}
</style>