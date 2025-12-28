<template>
  <div class="detail-container">
    <div v-if="loading" class="loading-state">
        <el-skeleton :rows="10" animated />
    </div>

    <div v-else class="content-layout">
        <!-- Fixed Header -->
        <div class="fixed-header">
             <div class="header-inner">
                <div class="header-left">
                    <el-button @click="$router.back()">
                        <el-icon class="mr-1"><ArrowLeft /></el-icon> 返回列表
                    </el-button>
                </div>
                <div class="header-right" v-if="isAdmin">
                    <template v-if="isEditing">
                        <el-button @click="cancelEdit">放弃编辑</el-button>
                        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
                    </template>
                    <template v-else>
                        <el-button @click="toggleEdit">编辑岗位</el-button>
                        <el-button type="success" @click="toggleMatches">
                            {{ showMatches ? '隐藏匹配' : '智能匹配' }}
                        </el-button>
                    </template>
                </div>
             </div>
        </div>

        <!-- Scrollable Content -->
        <div class="scrollable-content">
            <div class="main-layout" :class="{ 'has-sidebar': showMatches }">
                <!-- Job Detail Section -->
                <div class="job-section">
                    <el-card class="box-card job-card" shadow="never">
                         <!-- Job Title & Meta -->
                         <div class="job-header-info">
                            <div class="title-row">
                                <el-input v-if="isEditing" v-model="form.title" placeholder="职位名称" class="title-input mb-4" />
                                <h1 v-else class="page-title">{{ form.title }}</h1>
                                
                                <div class="tags-row" v-if="!isEditing">
                                    <el-tag type="success" class="mr-2">{{ form.level }}</el-tag>
                                    <el-tag type="warning" effect="plain">{{ form.salary_min }} - {{ form.salary_max }}</el-tag>
                                    <el-tag type="info" class="ml-2">{{ form.city }}</el-tag>
                                </div>
                            </div>
                            
                            <!-- Editing Meta Fields -->
                            <div v-if="isEditing" class="edit-meta-grid mt-4">
                                <el-form label-position="top">
                                    <el-row :gutter="20">
                                        <el-col :span="8">
                                            <el-form-item label="职级">
                                                <el-select v-model="form.level_id" placeholder="选择职级" style="width: 100%">
                                                    <el-option v-for="l in metaStore.levels" :key="l.id" :label="l.name" :value="l.id" />
                                                </el-select>
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="8">
                                            <el-form-item label="薪资范围">
                                                <div class="flex gap-2">
                                                    <el-input v-model="form.salary_min" placeholder="Min" />
                                                    <span class="sep">-</span>
                                                    <el-input v-model="form.salary_max" placeholder="Max" />
                                                </div>
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="8">
                                            <el-form-item label="城市">
                                                <el-select v-model="form.city_id" placeholder="选择城市" style="width: 100%">
                                                    <el-option v-for="c in metaStore.cities" :key="c.id" :label="c.name" :value="c.id" />
                                                </el-select>
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                    <el-row :gutter="20">
                                        <el-col :span="8">
                                            <el-form-item label="最低经验(年)">
                                                <el-input-number v-model="form.min_years" :min="0" style="width: 100%" />
                                            </el-form-item>
                                        </el-col>
                                        <el-col :span="8">
                                            <el-form-item label="学历要求">
                                                <el-select v-model="form.degree_required_id" placeholder="学历要求" style="width: 100%">
                                                    <el-option v-for="d in metaStore.degrees" :key="d.id" :label="d.name" :value="d.id" />
                                                </el-select>
                                            </el-form-item>
                                        </el-col>
                                    </el-row>
                                </el-form>
                            </div>

                            <!-- Read-only Meta Info -->
                            <div v-else class="meta-info-grid mt-6">
                                <div class="info-item">
                                    <el-icon><Location /></el-icon> {{ form.city }}
                                </div>
                                <div class="info-item">
                                    <el-icon><Timer /></el-icon> 最低 {{ form.min_years }} 年经验
                                </div>
                                <div class="info-item">
                                    <el-icon><School /></el-icon> {{ form.degree_required }}
                                </div>
                            </div>
                         </div>

                         <el-divider />
                         
                         <!-- Skills -->
                         <div class="section-block">
                            <h3 class="section-title">必需技能</h3>
                            <div v-if="isEditing">
                                 <el-select 
                                    v-model="form.required_skill_ids" 
                                    multiple 
                                    filterable 
                                    placeholder="选择技能"
                                    class="w-full"
                                    style="width: 100%"
                                >
                                    <el-option v-for="s in metaStore.skills" :key="s.id" :label="s.name" :value="s.id" />
                                </el-select>
                            </div>
                            <div v-else class="tags-wrapper">
                                <el-tag v-for="s in form.required_skills" :key="s" class="mr-2 mb-2" type="danger" effect="light">{{ s }}</el-tag>
                                <span v-if="!form.required_skills?.length" class="text-gray-400">无</span>
                            </div>
                         </div>

                         <div class="section-block mt-6">
                            <h3 class="section-title">加分技能</h3>
                            <div v-if="isEditing">
                                 <el-select 
                                    v-model="form.nice_skill_ids" 
                                    multiple 
                                    filterable 
                                    placeholder="选择技能"
                                    class="w-full"
                                    style="width: 100%"
                                >
                                    <el-option v-for="s in metaStore.skills" :key="s.id" :label="s.name" :value="s.id" />
                                </el-select>
                            </div>
                            <div v-else class="tags-wrapper">
                                <el-tag v-for="s in form.nice_to_have_skills" :key="s" type="info" class="mr-2 mb-2">{{ s }}</el-tag>
                                <span v-if="!form.nice_to_have_skills?.length" class="text-gray-400">无</span>
                            </div>
                         </div>

                         <el-divider />

                         <!-- Description -->
                         <div class="section-block">
                            <h3 class="section-title">职位描述</h3>
                            <el-input 
                                v-if="isEditing" 
                                v-model="form.description" 
                                type="textarea" 
                                :rows="10" 
                                placeholder="输入职位描述..." 
                            />
                            <div v-else class="desc-content whitespace-pre-wrap leading-relaxed text-gray-700">
                                {{ form.description || '暂无详细描述' }}
                            </div>
                         </div>
                    </el-card>
                </div>

                <!-- Matches Sidebar (Admin Only) -->
                <div v-if="showMatches && isAdmin" class="matches-sidebar">
                     <div class="sidebar-header">
                        <h3>推荐候选人</h3>
                        <el-button type="primary" link size="small" :loading="matching" @click="runMatching">重新匹配</el-button>
                    </div>
                    
                    <div v-loading="matchLoading" class="match-list-container">
                        <el-empty v-if="!matches.length" description="暂无匹配候选人" image-size="80" />
                        
                        <div v-else class="match-cards">
                            <el-card v-for="match in matches" :key="match.resume.id" class="match-card mb-3" shadow="hover" :body-style="{ padding: '15px' }">
                                <div class="match-card-header flex justify-between items-start">
                                    <div class="candidate-basic">
                                        <div class="font-bold text-lg">{{ match.resume.candidate_name }}</div>
                                        <div class="text-xs text-gray-500 mt-1">{{ match.resume.gender }} | {{ match.resume.years_of_experience }}年 | {{ match.resume.current_level }}</div>
                                    </div>
                                    <div class="score-badge" :class="getScoreClass(match.score)">
                                        {{ match.score }}
                                    </div>
                                </div>
                                
                                <div class="match-reasons mt-3">
                                    <div v-if="match.llm_reason" class="reason-text text-xs text-gray-600 line-clamp-3">
                                        {{ match.llm_reason }}
                                    </div>
                                    <div v-else-if="match.calculate_reason" class="reason-text text-xs text-gray-600 line-clamp-3">
                                        {{ match.calculate_reason }}
                                    </div>
                                </div>

                                <div class="card-actions mt-3 pt-3 border-t border-gray-100 text-right">
                                    <el-button type="primary" link size="small" @click="$router.push(`/resumes/${match.resume.id}`)">
                                        查看简历 <el-icon class="el-icon--right"><Right /></el-icon>
                                    </el-button>
                                </div>
                            </el-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { Location, Money, User, Timer, School, Loading, ArrowLeft, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const jobId = Number(route.params.id)
const metaStore = useMetaStore()

const loading = ref(true)
const saving = ref(false)
const isEditing = ref(false)
const showMatches = ref(false)
const matchLoading = ref(false)
const matching = ref(false)

const isAdmin = ref(false)
const currentUser = ref<any>(null)

// Form Data
const form = reactive({
    id: 0,
    title: '',
    city: '',
    city_id: null as number | null,
    level: '',
    level_id: null as number | null,
    salary_min: 0,
    salary_max: 0,
    min_years: 0,
    degree_required: '',
    degree_required_id: null as number | null,
    required_skills: [] as string[],
    required_skill_ids: [] as number[],
    nice_to_have_skills: [] as string[],
    nice_skill_ids: [] as number[],
    description: ''
})

// Original Data for Cancel
const originalData = ref<any>(null)
const matches = ref<any[]>([])

const getScoreClass = (score: number) => {
    if (score >= 80) return 'score-high'
    if (score >= 60) return 'score-mid'
    return 'score-low'
}

const initData = async () => {
    loading.value = true
    try {
        const res = await supabaseService.getJobDetail(jobId)
        if (res.data) {
            originalData.value = JSON.parse(JSON.stringify(res.data))
            syncForm(res.data)
        }
    } catch (e) {
        console.error(e)
        ElMessage.error('加载岗位详情失败')
    } finally {
        loading.value = false
    }
}

const syncForm = (data: any) => {
    form.id = data.id
    form.title = data.title
    form.city = data.city
    form.city_id = data.city_id
    form.level = data.level
    form.level_id = data.level_id
    form.salary_min = data.salary_min
    form.salary_max = data.salary_max
    form.min_years = data.min_years
    form.degree_required = data.degree_required
    form.degree_required_id = data.degree_required_id
    form.required_skills = [...(data.required_skills || [])]
    form.required_skill_ids = [...(data.required_skill_ids || [])]
    form.nice_to_have_skills = [...(data.nice_to_have_skills || [])]
    form.nice_skill_ids = [...(data.nice_skill_ids || [])]
    form.description = data.description
}

const toggleEdit = () => {
    isEditing.value = true
    showMatches.value = false // Hide matches when editing to focus
}

const cancelEdit = () => {
    isEditing.value = false
    if (originalData.value) {
        syncForm(originalData.value)
    }
}

const handleSave = async () => {
    saving.value = true
    try {
        const updateData = {
            title: form.title,
            city_id: form.city_id,
            level_id: form.level_id,
            salary_min: Number(form.salary_min),
            salary_max: Number(form.salary_max),
            min_years: Number(form.min_years),
            degree_required_id: form.degree_required_id,
            required_skill_ids: form.required_skill_ids,
            nice_skill_ids: form.nice_skill_ids,
            description: form.description
        }
        
        const { error } = await supabaseService.updateJob(jobId, updateData)
        if (error) throw error
        
        ElMessage.success('保存成功')
        isEditing.value = false
        
        // Refresh data to get updated names (since we only sent IDs)
        await initData()
    } catch (e) {
        console.error(e)
        ElMessage.error('保存失败')
    } finally {
        saving.value = false
    }
}

const toggleMatches = () => {
    showMatches.value = !showMatches.value
    if (showMatches.value && matches.value.length === 0) {
        loadMatches()
    }
}

const loadMatches = async () => {
    matchLoading.value = true
    try {
        const matchRes = await supabaseService.getJobMatches(jobId)
        if (matchRes.data) {
            matches.value = matchRes.data
            // Trigger LLM evaluation if needed
            matches.value.forEach(async (match) => {
                if (match.llm_score === null || match.llm_score === undefined) {
                    try {
                         const { data, error } = await supabaseService.evaluateMatch(match.resume.id, jobId)
                         if (!error && data && data.success) {
                            match.llm_score = data.score
                            match.llm_reason = data.reason
                        }
                    } catch (e) {}
                }
            })
        }
    } catch (e) {
        console.error(e)
    } finally {
        matchLoading.value = false
    }
}

const runMatching = async () => {
    matching.value = true
    try {
        const { data: resumesData } = await supabaseService.getResumes({ page: 1, pageSize: 100 })
        const resumes = resumesData.items
        let successCount = 0
        for (const resume of resumes) {
            const { error } = await supabaseService.evaluateMatch(resume.id, jobId)
            if (!error) successCount++
        }
        ElMessage.success(`重新计算完成，处理 ${successCount} 份简历`)
        loadMatches()
    } catch (e) {
        ElMessage.error('匹配计算失败')
    } finally {
        matching.value = false
    }
}

onMounted(async () => {
    metaStore.fetchMeta()
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
    height: calc(100vh - 40px); /* Adjust based on global layout */
    display: flex;
    flex-direction: column;
    background: #f5f7fa;
}

.fixed-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    z-index: 100;
    padding: 0 40px;
    display: flex;
    align-items: center;
}
.header-inner {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.scrollable-content {
    margin-top: 60px;
    padding: 20px;
    height: calc(100vh - 60px);
    overflow-y: auto;
}

.main-layout {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    gap: 20px;
    transition: all 0.3s ease;
}
.main-layout.has-sidebar {
    max-width: 1400px; /* Expand when sidebar is open */
}

.job-section {
    flex: 1;
    min-width: 0; /* Prevent overflow */
}

.matches-sidebar {
    width: 350px;
    flex-shrink: 0;
    background: #fff;
    border-radius: 4px;
    border: 1px solid #ebeef5;
    display: flex;
    flex-direction: column;
    height: fit-content;
    max-height: calc(100vh - 100px);
    position: sticky;
    top: 20px;
}

.sidebar-header {
    padding: 15px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.sidebar-header h3 { margin: 0; font-size: 16px; }

.match-list-container {
    padding: 15px;
    overflow-y: auto;
    max-height: calc(100vh - 160px);
}

.job-card {
    min-height: 500px;
}

.page-title {
    margin: 0 0 10px 0;
    font-size: 24px;
    color: #303133;
}

.meta-info-grid {
    display: flex;
    gap: 30px;
    color: #606266;
}
.info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 15px;
    border-left: 4px solid #409eff;
    padding-left: 10px;
}

.score-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 14px;
}
.score-high { color: #67c23a; background: #f0f9eb; }
.score-mid { color: #e6a23c; background: #fdf6ec; }
.score-low { color: #f56c6c; background: #fef0f0; }

.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
.ml-2 { margin-left: 8px; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.pt-3 { padding-top: 12px; }
.text-gray-400 { color: #909399; }
.text-gray-500 { color: #909399; }
.text-gray-600 { color: #606266; }
.text-gray-700 { color: #303133; }
.text-xs { font-size: 12px; }
.text-right { text-align: right; }
.font-bold { font-weight: bold; }
.text-lg { font-size: 18px; }
</style>