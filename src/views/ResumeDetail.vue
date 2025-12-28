<template>
  <div class="detail-container">
    <div v-if="loading" key="loading" class="loading-state">
        <el-skeleton :rows="10" animated />
    </div>

    <div v-else-if="showEmptyState" key="empty" class="empty-state-container h-full flex items-center justify-center">
        <el-empty description="您还没有简历">
            <el-button type="primary" size="large" @click="startCreating">完善简历</el-button>
        </el-empty>
    </div>

    <!-- Match Mode View -->
    <div v-else-if="showMatchMode" key="match-content" class="content-layout">
        <div class="fixed-header">
             <div class="header-content flex justify-between items-center">
                <el-button @click="closeMatches">
                    <el-icon class="mr-1"><Back /></el-icon> 返回简历详情
                </el-button>
             </div>
        </div>

        <div class="scrollable-content">
            <div class="match-container" style="max-width: 1200px; margin: 0 auto;">
                <el-table :data="matchTableData" v-loading="matchTableLoading" stripe border>
                    <el-table-column prop="id" label="ID" width="80" align="center" />
                    <el-table-column prop="title" label="职位名称" width="200" show-overflow-tooltip />
                    <el-table-column prop="city" label="城市" width="100" align="center" />
                    <el-table-column label="匹配度" width="120" sortable prop="match_score" align="center">
                        <template #default="scope">
                            <el-tag :type="getScoreType(scope.row.match_score)" effect="dark">
                                {{ scope.row.match_score }}分
                            </el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="匹配分析" min-width="300">
                        <template #default="scope">
                            <div v-if="scope.row.match_info.calculate_reason" class="text-sm text-gray-600 mb-2">
                                <span class="font-bold">规则匹配:</span> {{ scope.row.match_info.calculate_reason }}
                            </div>
                            <div v-if="scope.row.match_info.llm_score" class="p-2 bg-blue-50 rounded">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-bold text-blue-600">AI 评分: {{ scope.row.match_info.llm_score }}</span>
                                </div>
                                <div class="text-xs text-gray-600 leading-relaxed">
                                    {{ scope.row.match_info.llm_reason }}
                                </div>
                            </div>
                            <div v-else class="loading-ai">
                                <el-icon class="is-loading"><Loading /></el-icon> AI正在深度分析中...
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column label="薪资范围" width="150" align="center">
                         <template #default="scope">
                             {{ scope.row.salary_min }} - {{ scope.row.salary_max }}
                         </template>
                    </el-table-column>
                    <el-table-column label="操作" width="100" fixed="right" align="center">
                        <template #default="scope">
                            <el-button type="primary" link @click="viewJobDetail(scope.row.id)">查看职位</el-button>
                        </template>
                    </el-table-column>
                </el-table>
                
                <div class="pagination mt-4 flex justify-end bg-white p-4">
                    <el-pagination
                        v-model:current-page="matchPage"
                        v-model:page-size="matchPageSize"
                        :page-sizes="[5, 10, 20]"
                        :total="matchTotal"
                        layout="total, sizes, prev, pager, next, jumper"
                        @size-change="handleMatchSizeChange"
                        @current-change="handleMatchPageChange"
                    />
                </div>
            </div>
        </div>
    </div>

    <div v-else key="content" class="content-layout">
        <div class="fixed-header">
             <div class="header-content flex justify-end gap-2">
                <template v-if="isEditing">
                    <el-button @click="cancelEdit">放弃编辑</el-button>
                    <el-button type="primary" @click="handleSave" :loading="saving">
                       保存
                    </el-button>
                </template>
                <template v-else>
                    <el-button @click="toggleEdit">
                       去编辑
                    </el-button>
                    <el-button type="success" @click="toggleMatches">
                       智能匹配
                    </el-button>
                </template>
             </div>
        </div>

        <div class="scrollable-content">
            <div class="main-layout flex gap-4" style="display: flex; gap: 20px; align-items: flex-start;">
                <!-- 左侧：简历档案 (编辑/查看) -->
                <div class="resume-section" style="flex: 1; min-width: 0;">
                    <el-card class="box-card resume-card" shadow="never" :body-style="{ padding: '0px' }">
                        <div class="resume-info" style="padding: 20px;">
                            <!-- 基本信息 - 垂直排列 -->
                            <div class="info-section flex-col" style="display: flex; flex-direction: column; gap: 15px;">
                                <div class="info-row">
                                    <span class="label">姓名:</span>
                                    <div class="value-content">
                                        <el-input 
                                            v-if="isEditing" 
                                            v-model="form.candidate_name" 
                                            placeholder="姓名" 
                                        />
                                        <span v-else class="text-large font-bold">{{ form.candidate_name || resume?.candidate_name || '您的姓名' }}</span>
                                    </div>
                                </div>

                                <!-- 头像区域 (移到姓名下方) -->
                                <div class="info-row">
                                    <span class="label">头像:</span>
                                    <div class="value-content avatar-section">
                                        <el-upload
                                            v-if="isEditing"
                                            class="avatar-uploader"
                                            action="#"
                                            :show-file-list="false"
                                            :http-request="uploadAvatar"
                                            :before-upload="beforeAvatarUpload"
                                        >
                                            <div v-if="form.avatar_url || resume?.avatar_url" class="avatar-wrapper">
                                                <el-avatar :size="100" :src="form.avatar_url || resume?.avatar_url" />
                                                <div class="upload-mask"><el-icon><Plus /></el-icon></div>
                                            </div>
                                            <div v-else class="avatar-placeholder">
                                                <el-icon class="avatar-uploader-icon"><Plus /></el-icon>
                                                <span>上传头像</span>
                                            </div>
                                        </el-upload>
                                        <el-avatar v-else :size="100" :src="resume?.avatar_url || defaultAvatar" />
                                    </div>
                                </div>
                                
                                <div class="info-row">
                                    <span class="label">当前职级:</span>
                                    <div class="value-content">
                                        <el-select 
                                            v-if="isEditing" 
                                            v-model="form.current_level_id" 
                                            placeholder="当前职级" 
                                            style="width: 100%"
                                        >
                                            <el-option v-for="l in meta.levels" :key="l.id" :label="l.name" :value="l.id" />
                                        </el-select>
                                        <span v-else>{{ resume?.current_level || '未设置' }}</span>
                                    </div>
                                </div>

                            <div class="info-row">
                                <span class="label">期望职位:</span>
                                <div class="value-content">
                                    <el-input 
                                        v-if="isEditing" 
                                        v-model="form.expected_title" 
                                        placeholder="期望职位 (如: 前端开发工程师)" 
                                    />
                                    <span v-else>{{ form.expected_title || resume?.expected_title || '未设置' }}</span>
                                </div>
                            </div>

                            <div class="info-row">
                                <span class="label">期望城市:</span> 
                                <div class="value-content">
                                    <el-select 
                                        v-if="isEditing" 
                                        v-model="form.expected_city_id" 
                                        placeholder="期望城市" 
                                        style="width: 100%"
                                    >
                                        <el-option v-for="c in meta.cities" :key="c.id" :label="c.name" :value="c.id" />
                                    </el-select>
                                    <span v-else>{{ getCityName(form.expected_city_id) || resume?.expected_city || '未设置' }}</span>
                                </div>
                            </div>
                            
                            <div class="info-row">
                                <span class="label">工作经验:</span> 
                                <div class="value-content">
                                    <div v-if="isEditing" class="inline-edit flex items-center" style="flex-wrap: nowrap;">
                                        <el-input-number 
                                            v-model="form.years_of_experience" 
                                            :min="0" 
                                            controls-position="right"
                                            style="width: 100%"
                                        />
                                        <span class="ml-2 whitespace-nowrap">年</span>
                                    </div>
                                    <span v-else>{{ form.years_of_experience ?? resume?.years_of_experience }} 年</span>
                                </div>
                            </div>
                            
                            <div class="info-row">
                                <span class="label">期望薪资:</span> 
                                <div class="value-content">
                                    <div v-if="isEditing" class="salary-inputs flex items-center gap-2">
                                        <el-input-number v-model="form.expected_salary_min" :min="0" placeholder="Min" :step="1000" style="width: 100%" />
                                        <span class="separator">-</span>
                                        <el-input-number v-model="form.expected_salary_max" :min="0" placeholder="Max" :step="1000" style="width: 100%" />
                                    </div>
                                    <span v-else>{{ form.expected_salary_min ?? resume?.expected_salary_min }} - {{ form.expected_salary_max ?? resume?.expected_salary_max }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                        
                    <el-divider>技能栈</el-divider>
                    <div class="skills-section">
                        <div v-if="isEditing">
                            <el-select 
                                v-model="form.skill_ids" 
                                multiple 
                                filterable 
                                placeholder="选择技能" 
                                class="w-100"
                            >
                                <el-option v-for="s in meta.skills" :key="s.id" :label="s.name" :value="s.id" />
                            </el-select>
                        </div>
                        <div v-else class="min-h-20">
                            <el-tag v-for="s in getSkillNames(form.skill_ids)" :key="s" class="mr-2 mb-2">{{ s }}</el-tag>
                            <span v-if="!form.skill_ids?.length" class="text-gray">暂无技能</span>
                        </div>
                    </div>

                    <el-divider>教育背景</el-divider>
                    <div class="educations-section">
                        <div v-for="(edu, idx) in form.educations" :key="edu._key || idx" class="edu-item-wrapper relative group">
                            <div class="item-content-group">
                                <el-button 
                                    v-if="isEditing" 
                                    class="delete-btn" 
                                    type="danger" 
                                    circle 
                                    size="small" 
                                    @click.stop="removeEducation(idx)"
                                >
                                    <el-icon><Delete /></el-icon>
                                </el-button>
                                
                                <div class="edu-row mb-2">
                                    <div class="w-full">
                                        <el-input 
                                            v-if="isEditing" 
                                            v-model="edu.school" 
                                            placeholder="学校名称" 
                                        />
                                        <strong v-else class="block text-lg mb-1">{{ edu.school || '学校名称' }}</strong>
                                    </div>
                                </div>
                                
                                <div class="edu-row flex gap-4 items-center">
                                    <div class="flex-1">
                                        <el-select 
                                            v-if="isEditing" 
                                            v-model="edu.degree_id" 
                                            placeholder="学历"
                                            size="default"
                                            style="width: 100%"
                                        >
                                            <el-option v-for="d in meta.degrees" :key="d.id" :label="d.name" :value="d.id" />
                                        </el-select>
                                        <span v-else class="block text-gray-600">{{ getDegreeName(edu.degree_id) || '学历' }}</span>
                                    </div>
                                    <span v-if="!isEditing" class="text-gray-300">|</span>
                                    <div class="flex-1">
                                        <el-select 
                                            v-if="isEditing" 
                                            v-model="edu.major_industry_id" 
                                            placeholder="专业方向"
                                            size="default"
                                            style="width: 100%"
                                        >
                                            <el-option v-for="i in meta.industries" :key="i.id" :label="i.name" :value="i.id" />
                                        </el-select>
                                        <span v-else class="block text-gray-600">{{ getIndustryName(edu.major_industry_id) || '相关专业' }}</span>
                                    </div>
                                </div>
                            </div>
                            <el-divider v-if="idx < form.educations.length - 1" border-style="dashed" />
                        </div>
                        <el-button v-if="isEditing" class="mt-4 w-100 dashed-btn" @click="addEducation">+ 添加教育经历</el-button>
                    </div>

                    <el-divider>工作经历</el-divider>
                    <div class="experiences-section">
                        <div v-for="(exp, idx) in form.experiences" :key="exp._key || idx" class="exp-item-wrapper relative group">
                            <div class="item-content-group">
                                <el-button 
                                    v-if="isEditing" 
                                    class="delete-btn" 
                                    type="danger" 
                                    circle 
                                    size="small" 
                                    @click.stop="removeExperience(idx)"
                                >
                                    <el-icon><Delete /></el-icon>
                                </el-button>

                                <div class="exp-row mb-2 flex flex-col gap-2">
                                    <div class="w-full">
                                        <el-input 
                                            v-if="isEditing" 
                                            v-model="exp.company_name" 
                                            placeholder="公司名称" 
                                            class="mb-2"
                                        />
                                        <strong v-else class="block text-lg mb-1">{{ exp.company_name || '公司名称' }}</strong>
                                    </div>
                                    <div class="w-full">
                                        <el-select 
                                            v-if="isEditing" 
                                            v-model="exp.industry_id" 
                                            placeholder="行业" 
                                            size="default"
                                            style="width: 100%"
                                        >
                                            <el-option v-for="i in meta.industries" :key="i.id" :label="i.name" :value="i.id" />
                                        </el-select>
                                        <el-tag v-else size="small" type="info">{{ getIndustryName(exp.industry_id) || '行业' }}</el-tag>
                                    </div>
                                </div>
                                
                                <div class="exp-desc mt-2">
                                    <el-input 
                                        v-if="isEditing" 
                                        v-model="exp.description" 
                                        type="textarea" 
                                        :rows="3" 
                                        placeholder="工作描述" 
                                    />
                                    <p v-else class="desc whitespace-pre-wrap text-gray-600 leading-relaxed">{{ exp.description || '工作描述...' }}</p>
                                </div>
                            </div>
                            <el-divider v-if="idx < form.experiences.length - 1" border-style="dashed" />
                        </div>
                        <el-button v-if="isEditing" class="mt-4 w-100 dashed-btn" @click="addExperience">+ 添加工作经历</el-button>
                    </div>
                </el-card>
            </div>
        </div>
        </div>


        <!-- Removed Dialog -->
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { Delete, Plus, Back, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const metaStore = useMetaStore()

const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

// State
const loading = ref(true)
const saving = ref(false)
const activeField = ref<string | null>(null)
const currentUser = ref<any>(null)
const isCreating = ref(false)
const isEditing = ref(false)

// Match State
const showMatchMode = ref(false)
const matchTableData = ref<any[]>([])
const matchTableLoading = ref(false)
const matchPage = ref(1)
const matchPageSize = ref(10)
const matchTotal = ref(0)

// Data
const resume = ref<any>(null)
const meta = computed(() => ({
    cities: metaStore.cities || [],
    levels: metaStore.levels || [],
    skills: metaStore.skills || [],
    industries: metaStore.industries || [],
    degrees: metaStore.degrees || []
}))

// Form Data (for editing)
const form = ref<{
    educations: any[];
    experiences: any[];
    [key: string]: any;
}>({
    candidate_name: '',
    gender: 'M',
    expected_city_id: null,
    years_of_experience: 0,
    current_level_id: null,
    expected_title: '',
    expected_salary_min: 0,
    expected_salary_max: 0,
    avatar_url: '',
    avatar_id: null,
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

const showEmptyState = computed(() => {
    // Only for owner and when resume is not saved yet
    if (!isOwner.value) return false
    if (resume.value?.id) return false
    if (isCreating.value) return false
    return true
})

// Helpers
const generateKey = () => Math.random().toString(36).substr(2, 9)
const getCityName = (id: number) => meta.value.cities.find((c: any) => c.id === id)?.name
const getDegreeName = (id: number) => meta.value.degrees.find((d: any) => d.id === id)?.name
const getIndustryName = (id: number) => meta.value.industries.find((i: any) => i.id === id)?.name
const getSkillNames = (ids: number[]) => {
    if (!ids) return []
    return ids.map(id => meta.value.skills.find((s: any) => s.id === id)?.name).filter(Boolean)
}

// Methods
const getScoreType = (score: number) => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'danger'
}

const openMatches = () => {
    showMatchMode.value = true
    loadMatches()
}

const closeMatches = () => {
    showMatchMode.value = false
    // remove query param without reloading
    const query = { ...route.query }
    delete query.action
    router.replace({ query })
}

const toggleMatches = () => {
    openMatches()
}

const startCreating = () => {
    isCreating.value = true
    isEditing.value = true
    syncFormWithResume()
}

const syncFormWithResume = () => {
    if (!resume.value) return
    const r = resume.value
    
    // Map skills names to IDs if needed, but if we saved correctly, r.skills might be names
    // The API returns names in `skills` array usually.
    // We need to map them back to IDs for the form.
    const skillIds = r.skills?.map((name: string) => {
        const s = meta.value.skills.find((ms: any) => ms.name === name)
        return s ? s.id : null
    }).filter(Boolean) || []

    form.value = {
        id: r.id,
        candidate_name: r.candidate_name || r.name,
        gender: r.gender || 'M',
        expected_city_id: meta.value.cities.find((c: any) => c.name === r.expected_city)?.id,
        years_of_experience: r.years_of_experience || r.years,
        current_level_id: meta.value.levels.find((l: any) => l.name === r.current_level)?.id,
        expected_title: r.expected_title,
        expected_salary_min: r.salary_min,
        expected_salary_max: r.salary_max,
        avatar_url: r.avatar_url,
        avatar_id: r.avatar_id,
        skill_ids: skillIds,
        // Clone deep for arrays
        educations: r.educations?.map((e: any) => ({
            _key: generateKey(),
            school: e.school,
            degree_id: e.degree_id || e.degree?.id, 
            major_industry_id: e.major_industry_id || e.major_industry?.id
        })) || [],
        experiences: r.experiences?.map((e: any) => ({
            _key: generateKey(),
            company_name: e.company_name,
            industry_id: e.industry_id || e.industry?.id,
            description: e.description
        })) || []
    }
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
            if (!user) return 
            res = await supabaseService.getMyResume(user.id)
            if (!res.data) {
                // No resume yet, initialize empty
                resume.value = { user_id: user.id } 
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

        // Sync form if owner
        if (isOwner.value) {
            syncFormWithResume()
        }

        loading.value = false
    } catch (e) {
        console.error(e)
        loading.value = false
    }
}

const loadMatches = async () => {
    if (!resume.value?.id) return
    
    matchTableLoading.value = true
    try {
        // Ensure matches exist (calculate if needed)
        await supabaseService.ensureMatchEvaluations(resume.value.id)
        
        // Fetch paginated matches
        const { data, error } = await supabaseService.getJobsForResume(resume.value.id, {
            page: matchPage.value,
            pageSize: matchPageSize.value
        })
        
        if (error) throw error
        
        matchTableData.value = data.items
        matchTotal.value = data.total
        
        // Trigger AI evaluation for displayed items if missing
        matchTableData.value.forEach(async (item) => {
            if (!item.match_info.llm_score) {
                try {
                    const { data: aiData, error: aiError } = await supabaseService.evaluateMatch(resume.value.id, item.id)
                    if (!aiError && aiData) {
                         // Update local item
                         item.match_info.llm_score = aiData.llm_score
                         item.match_info.llm_reason = aiData.llm_reason
                    }
                } catch (e) {
                    console.error('AI evaluation failed for job ' + item.id, e)
                }
            }
        })
        
    } catch (e: any) {
        ElMessage.error('加载匹配数据失败: ' + e.message)
    } finally {
        matchTableLoading.value = false
    }
}

// Edit Logic
const editField = (field: string) => {
    activeField.value = field
}

const cancelEdit = () => {
    isEditing.value = false
    activeField.value = null
    syncFormWithResume() // Revert changes
}

const handleSave = async () => {
    if (!currentUser.value) return
    saving.value = true
    try {
        const { error } = await supabaseService.saveMyResume(currentUser.value.id, form.value)
        if (error) throw error
        
        // Success - update local resume data to reflect changes
        // Instead of full reload, we can just assume success or reload quietly
        // For simplicity and correctness, let's reload data but without loading spinner
        const res = await supabaseService.getMyResume(currentUser.value.id)
        if (res.data) {
            resume.value = res.data
            // Don't syncForm here, or it might overwrite cursor position? 
            // Actually, after save we close edit mode, so syncing is fine.
        }
        // Defer closing edit mode slightly to allow component events to finish
        setTimeout(() => {
            activeField.value = null
            isEditing.value = false
        }, 0)
    } catch (e: any) {
        ElMessage.error('保存失败: ' + e.message)
    } finally {
        saving.value = false
    }
}

const toggleEdit = () => {
    if (isEditing.value) {
        // Cancel edit? Or Save? Usually toggle off implies cancel or save. 
        // Given we have a Save button, toggleEdit might be just for entering edit mode.
        // But if used as a toggle, let's assume it enters edit mode.
        // User requirements: "View Mode: Go to Edit button", "Edit Mode: Save button".
        // So this function handles entering edit mode.
        isEditing.value = true
        syncFormWithResume() // Ensure form is fresh
    } else {
        isEditing.value = true
        syncFormWithResume()
    }
}



const handleMatchSizeChange = (val: number) => {
    matchPageSize.value = val
    matchPage.value = 1
    loadMatches()
}

const handleMatchPageChange = (val: number) => {
    matchPage.value = val
    loadMatches()
}

const viewJobDetail = (jobId: number) => {
    router.push(`/jobs/${jobId}`)
}

const addEducation = () => {
    const key = generateKey()
    form.value.educations.push({ _key: key, school: '', degree_id: null, major_industry_id: null })
    // Auto-edit the new item
    editField(`edu-${key}-school`)
}

const removeEducation = (index: number) => {
    // Defer clearing activeField to avoid conflict with event bubbling
    setTimeout(() => {
        activeField.value = null
    }, 0)
    form.value.educations.splice(index, 1)
    // handleSave() removed
}

const addExperience = () => {
    const key = generateKey()
    form.value.experiences.push({ _key: key, company_name: '', industry_id: null, description: '' })
    editField(`exp-${key}-company`)
}

const removeExperience = (index: number) => {
    setTimeout(() => {
        activeField.value = null
    }, 0)
    form.value.experiences.splice(index, 1)
    // handleSave() removed
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
    // Just display preview for now, will upload on save
    // But wait, el-upload http-request expects to do the upload. 
    // If we want to defer upload to "Save" button, we need to handle file selection manually or upload to a temporary location?
    // User asked "remove save immediately", "use Save button".
    // Typically avatar upload is separate because it returns a URL needed for the profile.
    // However, if we want to strict follow "use Save button", we should probably upload it then?
    // Or we can upload it now but NOT save the resume record itself?
    // Let's upload it to get the URL (since it's a file), update form.avatar_url, but NOT call handleSave().
    // The user has to click Save to persist the new avatar_url to the resume record.
    try {
        const { url, avatarId, error } = await supabaseService.uploadAvatar(currentUser.value.id, file)
        if (error) throw error
        
        form.value.avatar_url = url
        form.value.avatar_id = avatarId
        // handleSave() removed - wait for manual save
    } catch (e: any) {
        ElMessage.error('头像上传失败: ' + e.message)
    }
}

// Remove old saveResume method as it's replaced by handleSave

onMounted(async () => {
    await initData()
    if (route.query.action === 'match') {
        openMatches()
    }
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

.resume-card {
    min-height: 600px;
}

.avatar-section {
    display: flex;
    justify-content: flex-start;
}

.info-section {
    width: 100%;
}

.info-row {
    display: flex;
    align-items: center;
    gap: 15px;
    width: 100%;
}

.info-row .label {
    width: 80px;
    color: #606266;
    font-weight: 500;
    flex-shrink: 0;
}

.info-row .value-content {
    flex: 1;
    min-width: 0;
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

.content-layout {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 80px); /* Adjust based on global header height if any */
    overflow: hidden;
}

.fixed-header {
    background-color: white;
    padding: 10px 20px;
    border-bottom: 1px solid #eee;
    z-index: 100;
    flex-shrink: 0;
}

.scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

/* Remove old actions-header styles if no longer needed or keep for reference */
.header-content {
    max-width: 1200px;
    margin: 0 auto;
}
/* .header-content end */
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

.analysis-section {
    margin-bottom: 8px;
    padding: 8px;
    background-color: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #ebeef5;
}
.reason-title {
    font-weight: 600;
    font-size: 13px;
    color: #303133;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.reason-content {
    font-size: 12px;
    color: #606266;
    white-space: pre-wrap;
    line-height: 1.4;
}
.loading-ai {
    font-size: 12px;
    color: #909399;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
}
.text-gray-400 { color: #9ca3af; }
.text-xs { font-size: 12px; }

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
