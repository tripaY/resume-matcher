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
          <!-- 硬性匹配分析 -->
          <div v-if="row.calculate_reason" class="reason-section">
             <div class="reason-title">📊 硬性指标 ({{ row.calculate_score }}分)</div>
             <div class="reason-content">{{ row.calculate_reason }}</div>
          </div>
          
          <!-- LLM 匹配分析 -->
          <div class="reason-section mt-2">
             <div class="reason-title">
                🤖 AI 评价 
                <span v-if="row.llm_score">({{ row.llm_score }}分)</span>
                <span v-else class="text-gray-400 text-xs">(分析中...)</span>
             </div>
             <div v-if="row.llm_reason" class="reason-content">{{ row.llm_reason }}</div>
             <div v-else class="loading-ai">
                <el-icon class="is-loading"><Loading /></el-icon> AI 正在深度解读您的简历...
             </div>
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
import { Loading } from '@element-plus/icons-vue'

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
    
     // Trigger LLM evaluation for matches missing llm_score
    matches.value.forEach(async (match) => {
        if (match.llm_score === null || match.llm_score === undefined) {
            try {
                const { data, error } = await supabaseService.evaluateMatch(resume.id, match.job.id)
                if (!error && data && data.success) {
                    // Update local state
                    match.llm_score = data.score
                    match.llm_reason = data.reason
                }
            } catch (e) {
                console.error('Failed to evaluate match', e)
            }
        }
    })
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
.reason-section {
    margin-bottom: 8px;
    padding: 8px;
    background-color: #f8f9fa;
    border-radius: 4px;
}
.reason-title {
    font-weight: bold;
    font-size: 0.9em;
    color: #333;
    margin-bottom: 4px;
}
.reason-content {
    font-size: 0.85em;
    color: #666;
    white-space: pre-wrap; /* Preserve newlines */
    line-height: 1.4;
}
.loading-ai {
    font-size: 0.85em;
    color: #909399;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 4px;
}
.mt-2 {
    margin-top: 8px;
}
</style>