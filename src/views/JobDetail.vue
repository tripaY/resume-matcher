<template>
  <div class="detail-container">
    <el-button @click="$router.back()" class="mb-20">返回列表</el-button>
    
    <div v-if="loading" class="loading-state">
        <el-skeleton :rows="10" animated />
    </div>

    <div v-else class="content-wrapper">
        <!-- 左侧：岗位JD -->
        <div class="left-panel">
            <el-card class="box-card">
                <template #header>
                    <div class="card-header">
                        <span>岗位详情 #{{ job?.id }}</span>
                        <el-tag type="success">{{ job?.level }}</el-tag>
                    </div>
                </template>
                <div class="job-info">
                    <h2>{{ job?.title }}</h2>
                    <p><el-icon><Location /></el-icon> {{ job?.city }}</p>
                    <p><el-icon><Timer /></el-icon> 最低{{ job?.min_years }}年经验</p>
                    <p><el-icon><School /></el-icon> {{ job?.degree_required }}</p>
                    <p class="salary"><el-icon><Money /></el-icon> {{ job?.salary_min }} - {{ job?.salary_max }}</p>
                    
                    <el-divider>必需技能</el-divider>
                    <div class="skills">
                        <el-tag v-for="s in job?.required_skills" :key="s" type="warning" class="mr-2 mb-2">{{ s }}</el-tag>
                    </div>

                    <el-divider>加分技能</el-divider>
                    <div class="skills">
                        <el-tag v-for="s in job?.nice_to_have_skills" :key="s" type="info" class="mr-2 mb-2">{{ s }}</el-tag>
                    </div>

                    <el-divider>职位描述</el-divider>
                    <div class="desc-text">
                        这里展示职位的详细描述文本...
                    </div>
                </div>
            </el-card>
        </div>

        <!-- 右侧：智能岗人匹配 -->
        <div class="right-panel">
            <div class="panel-header">
                <div class="ph-title">
                    <h3>推荐候选人 (Top Candidates)</h3>
                    <el-button v-if="isAdmin" type="primary" size="small" :loading="matching" @click="runMatching">重新计算匹配</el-button>
                </div>
                <el-alert title="已为您筛选出最匹配的候选人，按分数降序排列" type="success" :closable="false" />
            </div>

            <div v-loading="matchLoading" class="match-list">
                <el-empty v-if="!matches.length" description="暂无匹配候选人" />
                
                <el-card v-for="match in matches" :key="match.resume.id" class="match-card mb-20" shadow="hover">
                    <div class="match-header">
                        <div class="candidate-info">
                            <h4>{{ match.resume.candidate_name }}</h4>
                            <span class="sub-info">{{ match.resume.gender }} | {{ match.resume.years_of_experience }}年</span>
                        </div>
                        <div class="score-badge" :class="getScoreClass(match.score)">
                            {{ match.score }}分
                        </div>
                    </div>
                    
                    <div class="resume-summary">
                        <span><el-icon><Location /></el-icon> {{ match.resume.expected_city }}</span>
                        <span><el-icon><User /></el-icon> {{ match.resume.current_level }}</span>
                        <span><el-icon><School /></el-icon> {{ getHighestDegree(match.resume) }}</span>
                    </div>

                    <div class="match-analysis">
                         <!-- 硬性匹配分析 -->
                         <div v-if="match.calculate_reason" class="analysis-section">
                             <div class="reason-title">📊 硬性指标 ({{ match.calculate_score }}分)</div>
                             <div class="reason-content">{{ match.calculate_reason }}</div>
                         </div>
                         
                         <!-- LLM 匹配分析 -->
                         <div class="analysis-section mt-2">
                             <div class="reason-title">
                                🤖 AI 评价 
                                <span v-if="match.llm_score">({{ match.llm_score }}分)</span>
                                <span v-else class="text-gray-400 text-xs">(分析中...)</span>
                             </div>
                             <div v-if="match.llm_reason" class="reason-content">{{ match.llm_reason }}</div>
                             <div v-else class="loading-ai">
                                <el-icon class="is-loading"><Loading /></el-icon> AI 正在深度解读...
                             </div>
                         </div>
                    </div>
                    
                    <div class="card-footer">
                        <el-button type="primary" link @click="$router.push(`/resumes/${match.resume.id}`)">查看简历详情 -></el-button>
                    </div>
                </el-card>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { Location, Money, User, Timer, School, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const jobId = Number(route.params.id)

const loading = ref(true)
const matchLoading = ref(true)
const job = ref<any>(null)
const matches = ref<any[]>([])
const currentUser = ref<any>(null)
const isAdmin = ref(false)
const matching = ref(false)

const getScoreClass = (score: number) => {
    if (score >= 80) return 'score-high'
    if (score >= 60) return 'score-mid'
    return 'score-low'
}

const getHighestDegree = (resume: any) => {
    if (!resume.educations || !resume.educations.length) return '无'
    const edu = resume.educations[0]
    // Handle both transformed and raw structure just in case
    return edu?.degrees?.name || edu?.degree || '无'
}

const initData = async () => {
    try {
        const res = await supabaseService.getJobDetail(jobId)
        job.value = res.data
        loading.value = false
        
        loadMatches()
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

const loadMatches = async () => {
    matchLoading.value = true
    try {
        const matchRes = await supabaseService.getJobMatches(jobId)
        if (matchRes.data) {
            matches.value = matchRes.data
            
             // Trigger LLM evaluation for matches missing llm_score
            matches.value.forEach(async (match) => {
                if (match.llm_score === null || match.llm_score === undefined) {
                    try {
                        const { data, error } = await supabaseService.evaluateMatch(match.resume.id, jobId)
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
    } finally {
        matchLoading.value = false
    }
}

const runMatching = async () => {
    if (!isAdmin.value) return
    matching.value = true
    try {
        // 1. Get all resumes
        const { data: resumesData } = await supabaseService.getResumes({ page: 1, pageSize: 100 })
        const resumes = resumesData.items
        
        // 2. Run match
        let successCount = 0
        for (const resume of resumes) {
            const { error } = await supabaseService.runMatch(resume.id, jobId)
            if (!error) successCount++
        }
        ElMessage.success(`匹配计算完成，成功匹配 ${successCount} 份简历`)
        loadMatches()
    } catch (e) {
        console.error(e)
        ElMessage.error('匹配计算出错')
    } finally {
        matching.value = false
    }
}

onMounted(async () => {
    const { data: { user } } = await supabaseService.getUser()
    if (user) {
        currentUser.value = user
        if (user.user_metadata?.role === 'admin') {
            isAdmin.value = true
        }
    }
    initData()
})
</script>

<style scoped>
.detail-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}
.mb-20 { margin-bottom: 20px; }
.mr-2 { margin-right: 8px; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }

.content-wrapper {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.left-panel {
    width: 30%;
    min-width: 300px;
}
.right-panel {
    flex: 1;
}

.ph-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.ph-title h3 {
    margin: 0;
}

.job-info h2 { margin-top: 0; }
.job-info p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    color: #606266;
}
.salary {
    color: #f56c6c !important;
    font-weight: bold;
    font-size: 18px;
}

.panel-header {
    margin-bottom: 20px;
}

/* Match Card Styles */
.match-card {
    transition: all 0.3s;
}
.match-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.match-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}
.candidate-info h4 {
    margin: 0 0 5px 0;
    font-size: 18px;
    color: #303133;
}
.sub-info {
    font-size: 13px;
    color: #909399;
}
.score-badge {
    font-size: 16px;
    font-weight: bold;
    padding: 4px 10px;
    border-radius: 4px;
}
.score-badge.success { color: #67c23a; background: #f0f9eb; }
.score-badge.warning { color: #e6a23c; background: #fdf6ec; }
.score-badge.danger { color: #f56c6c; background: #fef0f0; }

.resume-summary {
    display: flex;
    gap: 20px;
    margin-bottom: 15px;
    font-size: 14px;
    color: #606266;
    background: #f5f7fa;
    padding: 10px;
    border-radius: 4px;
}
.resume-summary span {
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Analysis Section Styles */
.match-analysis {
    margin-top: 15px;
}
.analysis-section {
    margin-bottom: 12px;
    padding: 12px;
    background-color: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #ebeef5;
}
.reason-title {
    font-weight: 600;
    font-size: 14px;
    color: #303133;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.reason-content {
    font-size: 13px;
    color: #606266;
    white-space: pre-wrap;
    line-height: 1.6;
}
.loading-ai {
    font-size: 13px;
    color: #909399;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
}

.card-footer {
    margin-top: 15px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #eee;
    padding-top: 10px;
}
</style>
