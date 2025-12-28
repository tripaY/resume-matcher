<template>
  <div class="detail-container">
    <div class="header-actions mb-20">
      <el-button @click="$router.back()">返回</el-button>
      <div v-if="isOwner" class="owner-actions">
        <el-button v-if="!isEditing" type="primary" @click="startEditing">编辑简历</el-button>
        <template v-else>
          <el-button @click="cancelEditing">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveResume">保存更改</el-button>
        </template>
      </div>
    </div>
    
    <div v-if="loading" class="loading-state">
        <el-skeleton :rows="10" animated />
    </div>

    <div v-else class="content-wrapper">
        <!-- 左侧：简历档案 (编辑/查看) -->
        <div class="left-panel" :class="{ 'full-width': isEditing }">
            <el-card class="box-card resume-card">
                <template #header>
                    <div class="card-header">
                        <span>简历档案</span>
                        <el-tag v-if="!isEditing">{{ resume?.current_level }}</el-tag>
                        <el-select v-else v-model="form.current_level_id" placeholder="当前职级" size="small" style="width: 100px">
                            <el-option v-for="l in meta.levels" :key="l.id" :label="l.name" :value="l.id" />
                        </el-select>
                    </div>
                </template>
                
                <div class="resume-info">
                    <!-- 头像区域 -->
                    <div class="avatar-section">
                        <el-upload
                            v-if="isEditing"
                            class="avatar-uploader"
                            action="#"
                            :show-file-list="false"
                            :http-request="uploadAvatar"
                            :before-upload="beforeAvatarUpload"
                        >
                            <div v-if="form.avatar_url" class="avatar-wrapper">
                                <el-avatar :size="100" :src="form.avatar_url" />
                                <div class="upload-mask"><el-icon><Plus /></el-icon></div>
                            </div>
                            <div v-else class="avatar-placeholder">
                                <el-icon class="avatar-uploader-icon"><Plus /></el-icon>
                                <span>上传头像</span>
                            </div>
                        </el-upload>
                        <el-avatar v-else :size="100" :src="resume?.avatar_url || defaultAvatar" />
                    </div>

                    <!-- 基本信息 -->
                    <div class="info-section">
                        <h2 v-if="!isEditing">{{ resume?.candidate_name }}</h2>
                        <el-input v-else v-model="form.candidate_name" placeholder="姓名" class="mb-2" />
                        
                        <div class="info-row">
                            <el-icon><Location /></el-icon> 
                            <span v-if="!isEditing">{{ resume?.expected_city }}</span>
                            <el-select v-else v-model="form.expected_city_id" placeholder="期望城市" size="small">
                                <el-option v-for="c in meta.cities" :key="c.id" :label="c.name" :value="c.id" />
                            </el-select>
                        </div>
                        
                        <div class="info-row">
                            <el-icon><Briefcase /></el-icon> 
                            <span v-if="!isEditing">{{ resume?.years_of_experience }}年经验</span>
                            <el-input-number v-else v-model="form.years_of_experience" :min="0" size="small" controls-position="right" />
                            <span v-if="isEditing" class="ml-2">年</span>
                        </div>
                        
                        <div class="info-row">
                            <el-icon><Money /></el-icon> 
                            <span v-if="!isEditing">期望薪资: {{ resume?.expected_salary_min }} - {{ resume?.expected_salary_max }}</span>
                            <div v-else class="salary-inputs">
                                <el-input-number v-model="form.expected_salary_min" :min="0" size="small" placeholder="Min" :step="1000" />
                                <span class="separator">-</span>
                                <el-input-number v-model="form.expected_salary_max" :min="0" size="small" placeholder="Max" :step="1000" />
                            </div>
                        </div>
                    </div>
                    
                    <el-divider>技能栈</el-divider>
                    <div class="skills-section">
                        <div v-if="!isEditing">
                            <el-tag v-for="s in resume?.skills" :key="s" class="mr-2 mb-2">{{ s }}</el-tag>
                        </div>
                        <el-select 
                            v-else 
                            v-model="form.skill_ids" 
                            multiple 
                            filterable 
                            placeholder="选择技能" 
                            class="w-100"
                        >
                            <el-option v-for="s in meta.skills" :key="s.id" :label="s.name" :value="s.id" />
                        </el-select>
                    </div>

                    <el-divider>教育背景</el-divider>
                    <div class="educations-section">
                        <div v-if="!isEditing">
                            <div v-for="(edu, idx) in resume?.educations" :key="idx" class="edu-item">
                                <p><strong>{{ edu.school }}</strong></p>
                                <p>{{ edu.degree?.name }} - {{ edu.major_industry?.name || '相关专业' }}</p>
                            </div>
                        </div>
                        <div v-else>
                            <div v-for="(edu, idx) in form.educations" :key="idx" class="edit-item-card">
                                <div class="edit-row">
                                    <el-input v-model="edu.school" placeholder="学校名称" />
                                    <el-button type="danger" circle size="small" @click="removeEducation(idx)"><el-icon><Delete /></el-icon></el-button>
                                </div>
                                <div class="edit-row mt-2">
                                    <el-select v-model="edu.degree_id" placeholder="学历">
                                        <el-option v-for="d in meta.degrees" :key="d.id" :label="d.name" :value="d.id" />
                                    </el-select>
                                    <el-select v-model="edu.major_industry_id" placeholder="专业方向">
                                        <el-option v-for="i in meta.industries" :key="i.id" :label="i.name" :value="i.id" />
                                    </el-select>
                                </div>
                            </div>
                            <el-button class="mt-2 w-100" @click="addEducation">+ 添加教育经历</el-button>
                        </div>
                    </div>

                    <el-divider>工作经历</el-divider>
                    <div class="experiences-section">
                         <div v-if="!isEditing">
                            <div v-for="(exp, idx) in resume?.experiences" :key="idx" class="exp-item">
                                <p><strong>{{ exp.company_name }}</strong> <el-tag size="small" type="info">{{ exp.industry?.name }}</el-tag></p>
                                <p class="desc">{{ exp.description }}</p>
                            </div>
                        </div>
                        <div v-else>
                            <div v-for="(exp, idx) in form.experiences" :key="idx" class="edit-item-card">
                                <div class="edit-row">
                                    <el-input v-model="exp.company_name" placeholder="公司名称" />
                                    <el-select v-model="exp.industry_id" placeholder="行业" style="width: 120px">
                                        <el-option v-for="i in meta.industries" :key="i.id" :label="i.name" :value="i.id" />
                                    </el-select>
                                    <el-button type="danger" circle size="small" @click="removeExperience(idx)"><el-icon><Delete /></el-icon></el-button>
                                </div>
                                <el-input 
                                    v-model="exp.description" 
                                    type="textarea" 
                                    :rows="3" 
                                    placeholder="工作描述" 
                                    class="mt-2" 
                                />
                            </div>
                             <el-button class="mt-2 w-100" @click="addExperience">+ 添加工作经历</el-button>
                        </div>
                    </div>
                </div>
            </el-card>
        </div>

        <!-- 右侧：智能匹配 (仅在非编辑模式下显示) -->
        <div v-if="!isEditing" class="right-panel">
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
                            <span class="company-tag">{{ match.job.city }} | {{ match.job.salary_range }}</span>
                        </div>
                        <div class="score-badge" :class="getScoreClass(match.score)">
                            {{ match.score }}分
                        </div>
                    </div>
                    
                    <div class="match-analysis mt-2">
                        <div v-if="match.reasons && match.reasons.length > 0">
                            <span class="label">匹配分析:</span>
                            <p class="reason-text">{{ match.reasons[0] }}</p>
                        </div>
                    </div>
                    
                    <div class="card-footer">
                        <el-button type="primary" link @click="$router.push(`/jobs/${match.job.id}`)">查看详情</el-button>
                    </div>
                </el-card>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { Location, Briefcase, Money, Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const metaStore = useMetaStore()

const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

// State
const loading = ref(true)
const matchLoading = ref(false)
const saving = ref(false)
const isEditing = ref(false)
const currentUser = ref<any>(null)

// Data
const resume = ref<any>(null)
const matches = ref<any[]>([])
const meta = computed(() => metaStore.meta)

// Form Data (for editing)
const form = ref<any>({
    candidate_name: '',
    gender: 'M',
    expected_city_id: null,
    years_of_experience: 0,
    current_level_id: null,
    expected_salary_min: 0,
    expected_salary_max: 0,
    avatar_url: '',
    skill_ids: [],
    educations: [],
    experiences: []
})

// Computed
const isMyResumePage = computed(() => route.path === '/my-resume')
const isOwner = computed(() => {
    if (isMyResumePage.value) return true
    return currentUser.value && resume.value && currentUser.value.id === resume.value.user_id
})

// Methods
const getScoreClass = (score: number) => {
    if (score >= 80) return 'score-high'
    if (score >= 60) return 'score-mid'
    return 'score-low'
}

const initData = async () => {
    loading.value = true
    try {
        // 1. Get User
        const { data: { user } } = await supabaseService.getUser()
        currentUser.value = user
        
        // 2. Get Meta
        if (!meta.value.cities.length) {
            await metaStore.fetchMeta()
        }

        // 3. Get Resume
        let res
        if (isMyResumePage.value) {
            if (!user) return // Should be redirected by guard
            res = await supabaseService.getMyResume(user.id)
            if (!res.data) {
                // No resume yet, initialize empty for editing
                isEditing.value = true
                resume.value = { user_id: user.id } // Placeholder
            } else {
                resume.value = res.data
            }
        } else {
            const id = Number(route.params.id)
            if (id) {
                res = await supabaseService.getResumeDetail(id)
                resume.value = res.data
            }
        }

        loading.value = false

        // 4. Get Matches (if exists)
        if (resume.value && resume.value.id) {
            loadMatches()
        }
    } catch (e) {
        console.error(e)
        loading.value = false
    }
}

const loadMatches = async () => {
    matchLoading.value = true
    try {
        const res = await supabaseService.getResumeMatches(resume.value.id)
        matches.value = res.data || []
    } finally {
        matchLoading.value = false
    }
}

// Edit Logic
const startEditing = () => {
    // Clone data to form
    const r = resume.value
    // Map skills names to IDs (Reverse lookup needed? Or we store IDs in resume object?)
    // Our DTO currently only has skill names. 
    // To support editing, we need the skill IDs.
    // The API `getResumeDetail` now returns `resume_skills(skills(name))`.
    // It does NOT return skill IDs directly in the easy DTO.
    // We should probably update the DTO or the raw data access.
    // For now, let's match names to IDs from meta.
    const skillIds = r.skills?.map((name: string) => {
        const s = meta.value.skills.find(ms => ms.name === name)
        return s ? s.id : null
    }).filter(Boolean) || []

    form.value = {
        id: r.id,
        candidate_name: r.candidate_name || r.name,
        gender: r.gender || 'M',
        expected_city_id: meta.value.cities.find(c => c.name === r.expected_city)?.id,
        years_of_experience: r.years_of_experience || r.years,
        current_level_id: meta.value.levels.find(l => l.name === r.current_level)?.id,
        expected_salary_min: r.salary_min,
        expected_salary_max: r.salary_max,
        avatar_url: r.avatar_url,
        skill_ids: skillIds,
        // Clone deep for arrays
        educations: r.educations?.map((e: any) => ({
            school: e.school,
            degree_id: e.degree_id || e.degree?.id, // Depends on what API returns
            major_industry_id: e.major_industry_id || e.major_industry?.id
        })) || [],
        experiences: r.experiences?.map((e: any) => ({
            company_name: e.company_name,
            industry_id: e.industry_id || e.industry?.id,
            description: e.description
        })) || []
    }
    isEditing.value = true
}

const cancelEditing = () => {
    isEditing.value = false
    // Reset form? Not strictly necessary as it will be overwritten on next startEditing
}

const addEducation = () => {
    form.value.educations.push({ school: '', degree_id: null, major_industry_id: null })
}

const removeEducation = (index: number) => {
    form.value.educations.splice(index, 1)
}

const addExperience = () => {
    form.value.experiences.push({ company_name: '', industry_id: null, description: '' })
}

const removeExperience = (index: number) => {
    form.value.experiences.splice(index, 1)
}

const beforeAvatarUpload = (rawFile: any) => {
  if (rawFile.type !== 'image/jpeg' && rawFile.type !== 'image/png') {
    ElMessage.error('Avatar picture must be JPG format!')
    return false
  } else if (rawFile.size / 1024 / 1024 > 2) {
    ElMessage.error('Avatar picture size can not exceed 2MB!')
    return false
  }
  return true
}

const uploadAvatar = async (options: any) => {
    if (!currentUser.value) return
    const { file } = options
    try {
        const { url, error } = await supabaseService.uploadAvatar(currentUser.value.id, file)
        if (error) throw error
        
        form.value.avatar_url = url
        ElMessage.success('头像上传成功')
    } catch (e: any) {
        ElMessage.error('头像上传失败: ' + e.message)
    }
}

const saveResume = async () => {
    if (!currentUser.value) return
    saving.value = true
    try {
        const { data, error } = await supabaseService.saveMyResume(currentUser.value.id, form.value)
        if (error) throw error
        
        ElMessage.success('保存成功')
        isEditing.value = false
        // Reload data
        await initData()
    } catch (e: any) {
        ElMessage.error('保存失败: ' + e.message)
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    initData()
})

watch(() => route.path, () => {
    initData()
})
</script>

<style scoped>
.detail-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}
.header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.mb-20 { margin-bottom: 20px; }
.mr-2 { margin-right: 8px; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }
.ml-2 { margin-left: 8px; }
.w-100 { width: 100%; }

.resume-info {
    display: flex;
    gap: 30px;
}
.avatar-section {
    flex-shrink: 0;
}
.info-section {
    flex: 1;
}

.avatar-uploader .el-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.avatar-placeholder {
    width: 100px;
    height: 100px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: #f5f7fa;
    color: #909399;
}

.avatar-wrapper {
    position: relative;
    width: 100px;
    height: 100px;
}

.upload-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.3s;
    border-radius: 50%; /* Match avatar circle if el-avatar is circle */
}
.avatar-wrapper:hover .upload-mask {
    opacity: 1;
}

.content-wrapper {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.left-panel {
    width: 35%; /* Slightly wider for better reading */
    min-width: 350px;
    transition: width 0.3s;
}
.left-panel.full-width {
    width: 100%;
    max-width: 800px;
    margin: 0 auto; /* Center when editing */
}

.right-panel {
    flex: 1;
}

.resume-card {
    min-height: 500px;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
}

.info-section {
    margin-bottom: 20px;
}
.info-row {
    display: flex;
    align-items: center;
    margin: 10px 0;
    color: #606266;
    gap: 8px;
}
.salary-inputs {
    display: flex;
    align-items: center;
    gap: 5px;
}

.edit-item-card {
    background: #f9fafc;
    border: 1px solid #e4e7ed;
    padding: 15px;
    border-radius: 4px;
    margin-bottom: 10px;
}
.edit-row {
    display: flex;
    gap: 10px;
    align-items: center;
}

/* Match Styles */
.match-card {
    border-left: 4px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
}
.match-card:hover {
    border-left-color: #409eff;
    transform: translateY(-2px);
}

.match-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}
.job-title h4 { margin: 0 0 5px 0; font-size: 16px; }
.company-tag { font-size: 12px; color: #909399; }

.score-badge { font-size: 20px; font-weight: bold; }
.score-high { color: #67c23a; }
.score-mid { color: #e6a23c; }
.score-low { color: #f56c6c; }

.reason-text {
    font-size: 13px;
    color: #606266;
    margin: 4px 0 0 0;
    background: #f0f9eb;
    padding: 8px;
    border-radius: 4px;
}
.label { font-size: 12px; font-weight: bold; color: #67c23a; }

.card-footer {
    margin-top: 10px;
    text-align: right;
}
</style>
