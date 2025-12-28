<template>
  <div class="detail-container">
    <el-button @click="$router.back()" class="mb-20">返回列表</el-button>
    
    <div v-if="loading" class="loading-state">
        <el-skeleton :rows="10" animated />
    </div>

    <div v-else class="content-wrapper">
        <!-- 左侧：简历档案 -->
        <div class="left-panel">
            <el-card class="box-card">
                <template #header>
                    <div class="card-header">
                        <span>简历档案 #{{ resume?.id }}</span>
                        <el-tag>{{ resume?.current_level }}</el-tag>
                    </div>
                </template>
                <div class="resume-info">
                    <h2>{{ resume?.candidate_name }}</h2>
                    <p><el-icon><Location /></el-icon> {{ resume?.expected_city }}</p>
                    <p><el-icon><Briefcase /></el-icon> {{ resume?.years_of_experience }}年经验</p>
                    <p><el-icon><Money /></el-icon> 期望薪资: {{ resume?.expected_salary_min }} - {{ resume?.expected_salary_max }}</p>
                    
                    <el-divider>技能栈</el-divider>
                    <div class="skills">
                        <el-tag v-for="s in resume?.skills" :key="s" class="mr-2 mb-2">{{ s }}</el-tag>
                    </div>

                    <el-divider>教育背景</el-divider>
                    <div v-for="(edu, idx) in resume?.educations" :key="idx" class="edu-item">
                        <p><strong>{{ edu.school }}</strong></p>
                        <p>{{ edu.degree }} - {{ edu.major }}</p>
                    </div>

                    <el-divider>工作经历</el-divider>
                     <div v-for="(exp, idx) in resume?.experiences" :key="idx" class="exp-item">
                        <p><strong>{{ exp.company_name }}</strong> ({{ exp.industry }})</p>
                        <p class="desc">{{ exp.description }}</p>
                    </div>
                </div>
            </el-card>
        </div>

        <!-- 右侧：智能匹配 -->
        <div class="right-panel">
            <div class="panel-header">
                <h3>智能人岗匹配 (Top Matches)</h3>
                <el-alert title="已为您筛选出最匹配的岗位，按分数降序排列" type="success" :closable="false" />
            </div>

            <div v-loading="matchLoading" class="match-list">
                <el-empty v-if="!matches.length" description="暂无匹配岗位" />
                
                <el-card v-for="match in matches" :key="match.job.id" class="match-card mb-20" shadow="hover">
                    <div class="match-header">
                        <div class="job-title">
                            <h4>{{ match.job.title }}</h4>
                            <span class="company-tag">{{ match.job.id }}</span>
                        </div>
                        <div class="score-badge" :class="getScoreClass(match.score)">
                            {{ match.score }}分
                        </div>
                    </div>
                    
                    <div class="job-summary">
                        <span><el-icon><Location /></el-icon> {{ match.job.city }}</span>
                        <span><el-icon><User /></el-icon> {{ match.job.level }}</span>
                        <span><el-icon><Timer /></el-icon> {{ match.job.min_years }}+年</span>
                    </div>

                    <div class="match-analysis">
                        <div v-if="match.advantages.length" class="analysis-section">
                            <span class="label success">优势:</span>
                            <ul>
                                <li v-for="adv in match.advantages" :key="adv">{{ adv }}</li>
                            </ul>
                        </div>
                        <div v-if="match.disadvantages.length" class="analysis-section">
                            <span class="label danger">劣势:</span>
                            <ul>
                                <li v-for="dis in match.disadvantages" :key="dis">{{ dis }}</li>
                            </ul>
                        </div>
                        <el-collapse class="mt-2">
                             <el-collapse-item title="查看详细打分理由">
                                <ul class="reasons-list">
                                    <li v-for="r in match.reasons" :key="r">{{ r }}</li>
                                </ul>
                             </el-collapse-item>
                        </el-collapse>
                    </div>
                    
                    <div class="card-footer">
                        <el-button type="primary" link @click="$router.push(`/jobs/${match.job.id}`)">查看岗位详情 -></el-button>
                    </div>
                </el-card>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getResumeDetail, getResumeMatches } from '../api'
import { Location, Briefcase, Money, User, Timer } from '@element-plus/icons-vue'

const route = useRoute()
const resumeId = Number(route.params.id)

const loading = ref(true)
const matchLoading = ref(true)
const resume = ref<any>(null)
const matches = ref<any[]>([])

const getScoreClass = (score: number) => {
    if (score >= 80) return 'score-high'
    if (score >= 60) return 'score-mid'
    return 'score-low'
}

const initData = async () => {
    try {
        const res = await getResumeDetail(resumeId)
        resume.value = res.data
        loading.value = false
        
        // Load matches
        const matchRes = await getResumeMatches(resumeId)
        matches.value = matchRes.data.matches
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
        matchLoading.value = false
    }
}

onMounted(() => {
    initData()
})
</script>

<style scoped>
.detail-container {
    max-width: 1400px;
    margin: 0 auto;
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

.resume-info h2 { margin-top: 0; }
.resume-info p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    color: #606266;
}

.edu-item, .exp-item {
    margin-bottom: 15px;
}
.desc {
    font-size: 13px;
    color: #909399;
    margin: 4px 0;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.match-card {
    border-left: 4px solid transparent;
}
.match-card:hover {
    border-left-color: #409eff;
}

.match-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.job-title h4 {
    margin: 0;
    font-size: 18px;
}
.company-tag {
    font-size: 12px;
    color: #909399;
}

.score-badge {
    font-size: 24px;
    font-weight: bold;
}
.score-high { color: #67c23a; }
.score-mid { color: #e6a23c; }
.score-low { color: #f56c6c; }

.job-summary {
    display: flex;
    gap: 20px;
    margin: 10px 0;
    color: #606266;
}
.job-summary span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.match-analysis {
    background: #f5f7fa;
    padding: 10px;
    border-radius: 4px;
}

.analysis-section {
    margin-bottom: 5px;
}
.label {
    font-weight: bold;
    font-size: 13px;
}
.label.success { color: #67c23a; }
.label.danger { color: #f56c6c; }

.match-analysis ul {
    margin: 4px 0 0 20px;
    padding: 0;
    font-size: 13px;
    color: #606266;
}

.reasons-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 12px;
    color: #909399;
}

.card-footer {
    margin-top: 10px;
    text-align: right;
}
</style>
