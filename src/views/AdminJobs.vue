<template>
  <div class="page-container">
    <!-- Main Job List View -->
    <div v-if="!showMatchMode">
        <div class="header-actions mb-4 flex justify-between">
            <h2>岗位管理</h2>
            <el-button type="primary" @click="handleCreate">发布职位</el-button>
        </div>

        <div class="filter-bar">
          <el-form :inline="true" :model="filters" class="demo-form-inline">
            <el-form-item label="城市">
              <el-select v-model="filters.city" placeholder="选择城市" clearable>
                <el-option v-for="c in metaStore.cities" :key="c.id" :label="c.name" :value="c.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="职级">
              <el-select v-model="filters.level" placeholder="选择职级" clearable>
                <el-option v-for="l in metaStore.levels" :key="l.id" :label="l.name" :value="l.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="技能">
              <el-select v-model="filters.skill" placeholder="要求技能" clearable>
                 <el-option v-for="s in metaStore.skills" :key="s.id" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="行业">
              <el-select v-model="filters.industry" placeholder="所属行业" clearable>
                 <el-option v-for="i in metaStore.industries" :key="i.id" :label="i.name" :value="i.name" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">筛选</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </div>

        <el-table :data="tableData" v-loading="loading" style="width: 100%" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="职位名称" width="180" />
          <el-table-column prop="city" label="城市" width="100" />
          <el-table-column prop="min_years" label="最低年限" width="100">
               <template #default="scope">
                  {{ scope.row.min_years }}年
              </template>
          </el-table-column>
          <el-table-column prop="level" label="职级" width="100">
              <template #default="scope">
                  <el-tag type="success">{{ scope.row.level }}</el-tag>
              </template>
          </el-table-column>
          <el-table-column label="薪资范围" width="150">
              <template #default="scope">
                  {{ scope.row.salary_min }} - {{ scope.row.salary_max }}
              </template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="scope">
              <el-button size="small" @click="viewDetail(scope.row.id)">查看</el-button>
              <el-button type="success" size="small" @click="handleSmartMatch(scope.row)">智能匹配</el-button>
              <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
              <el-button type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[5, 10, 20]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
    </div>

    <!-- Match Results View -->
    <div v-else>
        <div class="header-actions mb-4 flex justify-between items-center">
            <div class="flex items-center gap-4">
                <el-button icon="Back" circle @click="closeMatchView" />
                <h2 class="m-0">智能匹配结果: {{ currentJobTitle }}</h2>
            </div>
        </div>

        <el-table :data="matches" v-loading="matchLoading" style="width: 100%" stripe border>
            <el-table-column label="匹配度" width="100" align="center">
                <template #default="scope">
                     <el-progress type="circle" :percentage="scope.row.match_info?.score || 0" :width="50" :status="getScoreStatus(scope.row.match_info?.score || 0)" />
                </template>
            </el-table-column>
            
            <el-table-column prop="candidate_name" label="候选人" width="120">
                <template #default="scope">
                    <div class="font-bold">{{ scope.row.candidate_name }}</div>
                </template>
            </el-table-column>

            <el-table-column prop="gender" label="性别" width="80" />
            
            <el-table-column label="工作经验" width="120">
                <template #default="scope">
                    {{ scope.row.years_of_experience }}年
                </template>
            </el-table-column>

            <el-table-column label="学历信息" width="180">
                <template #default="scope">
                    <div v-for="edu in scope.row.educations" :key="edu.id" class="text-sm">
                        {{ edu.degree?.name }} · {{ edu.school }}
                    </div>
                </template>
            </el-table-column>

            <el-table-column label="期望" width="180">
                <template #default="scope">
                    <div>{{ scope.row.expected_city }}</div>
                    <div class="text-gray-500">{{ scope.row.salary_min }}-{{ scope.row.salary_max }}</div>
                </template>
            </el-table-column>

            <el-table-column label="AI 匹配分析" min-width="300">
                <template #default="scope">
                    <div v-if="scope.row.match_info?.llm_score !== undefined">
                        <div class="mb-2">
                             <el-tag size="small" effect="dark" :type="getScoreStatus(scope.row.match_info.llm_score)">
                                AI评分: {{ scope.row.match_info.llm_score }}
                            </el-tag>
                        </div>
                        <div class="text-sm text-gray-600 leading-relaxed line-clamp-3" :title="scope.row.match_info.llm_reason">
                            {{ scope.row.match_info.llm_reason }}
                        </div>
                    </div>
                    <div v-else class="text-gray-400 italic">
                        <el-icon class="is-loading"><Loading /></el-icon> 分析中...
                    </div>
                </template>
            </el-table-column>

            <el-table-column label="操作" width="120" fixed="right">
                <template #default="scope">
                    <el-button type="primary" link @click="router.push(`/resumes/${scope.row.id}`)">
                        查看详情
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>

    <!-- Edit Dialog -->
    <el-dialog v-model="showDialog" :title="isEdit ? '编辑职位' : '发布职位'" width="60%">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="职位名称" prop="title">
                        <el-input v-model="form.title" placeholder="例如: 高级前端工程师" />
                    </el-form-item>
                </el-col>
                <el-col :span="12">
                     <el-form-item label="城市" prop="city_id">
                        <el-select v-model="form.city_id" placeholder="选择城市" style="width: 100%">
                            <el-option v-for="c in metaStore.cities" :key="c.id" :label="c.name" :value="c.id" />
                        </el-select>
                    </el-form-item>
                </el-col>
            </el-row>
            
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="职级要求" prop="level_id">
                        <el-select v-model="form.level_id" placeholder="选择职级" style="width: 100%">
                            <el-option v-for="l in metaStore.levels" :key="l.id" :label="l.name" :value="l.id" />
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="12">
                    <el-form-item label="最低学历" prop="degree_required_id">
                         <el-select v-model="form.degree_required_id" placeholder="学历要求" style="width: 100%">
                            <el-option v-for="d in metaStore.degrees" :key="d.id" :label="d.name" :value="d.id" />
                        </el-select>
                    </el-form-item>
                </el-col>
            </el-row>

            <el-row :gutter="20">
                <el-col :span="12">
                     <el-form-item label="所属行业" prop="industry_id">
                        <el-select v-model="form.industry_id" placeholder="选择行业" style="width: 100%">
                            <el-option v-for="i in metaStore.industries" :key="i.id" :label="i.name" :value="i.id" />
                        </el-select>
                    </el-form-item>
                </el-col>
                 <el-col :span="12">
                    <el-form-item label="工作年限" prop="min_years">
                        <el-input-number v-model="form.min_years" :min="0" :max="20" label="最低年限" />
                        <span class="ml-2">年以上</span>
                    </el-form-item>
                </el-col>
            </el-row>

            <el-form-item label="薪资范围" required>
                <div class="flex items-center gap-2">
                    <el-form-item prop="salary_min" style="margin-bottom: 0">
                         <el-input-number v-model="form.salary_min" :min="0" :step="1000" placeholder="最低" style="width: 160px" />
                    </el-form-item>
                    <span>-</span>
                    <el-form-item prop="salary_max" style="margin-bottom: 0">
                        <el-input-number v-model="form.salary_max" :min="0" :step="1000" placeholder="最高" style="width: 160px" />
                    </el-form-item>
                    <span class="ml-2 text-gray-500">元/月</span>
                </div>
            </el-form-item>

            <el-form-item label="必备技能" prop="required_skill_ids">
                <el-select 
                    v-model="form.required_skill_ids" 
                    multiple 
                    filterable 
                    placeholder="选择必须具备的技能"
                    style="width: 100%"
                >
                    <el-option v-for="s in metaStore.skills" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
            </el-form-item>
            
            <el-form-item label="加分技能" prop="nice_skill_ids">
                <el-select 
                    v-model="form.nice_skill_ids" 
                    multiple 
                    filterable 
                    placeholder="选择加分项技能"
                    style="width: 100%"
                >
                    <el-option v-for="s in metaStore.skills" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
            </el-form-item>

            <el-form-item label="职位描述" prop="description">
                <el-input 
                    v-model="form.description" 
                    type="textarea" 
                    :rows="6" 
                    placeholder="请输入详细的职位描述和任职要求..." 
                />
            </el-form-item>
        </el-form>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="showDialog = false">取消</el-button>
                <el-button type="primary" @click="saveJob" :loading="saving">保存</el-button>
            </span>
        </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Back, Loading } from '@element-plus/icons-vue'
import type { JobDTO } from '../types/supabase'

const router = useRouter()
const metaStore = useMetaStore()
const loading = ref(false)
const tableData = ref<JobDTO[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// Match Dialog State
const showMatchDialog = ref(false)
const matchLoading = ref(false)
const matches = ref<any[]>([])
const currentJobId = ref<number | null>(null)

// Dialog State
const showDialog = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const form = ref<any>({})

const validateSalary = (rule: any, value: any, callback: any) => {
    if (value < form.value.salary_min) {
        callback(new Error('最高薪资不能低于最低薪资'))
    } else {
        callback()
    }
}

const rules = reactive<FormRules>({
    title: [{ required: true, message: '请输入职位名称', trigger: 'blur' }],
    city_id: [{ required: true, message: '请选择城市', trigger: 'change' }],
    level_id: [{ required: true, message: '请选择职级要求', trigger: 'change' }],
    degree_required_id: [{ required: true, message: '请选择最低学历', trigger: 'change' }],
    industry_id: [{ required: true, message: '请选择所属行业', trigger: 'change' }],
    min_years: [{ required: true, message: '请输入工作年限', trigger: 'blur' }],
    salary_min: [{ required: true, message: '请输入最低薪资', trigger: 'blur' }],
    salary_max: [
        { required: true, message: '请输入最高薪资', trigger: 'blur' },
        { validator: validateSalary, trigger: 'blur' }
    ],
    description: [{ required: true, message: '请输入职位描述', trigger: 'blur' }]
})

const filters = reactive({
    city: '',
    level: '',
    skill: '',
    industry: '',
    degree: '',
    min_years: undefined as number | undefined
})

const fetchData = async () => {
    loading.value = true
    try {
        const params: any = {
            ...filters,
            page: currentPage.value,
            pageSize: pageSize.value
        }
        
        Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === undefined) {
                delete params[key]
            }
        })
        
        const res = await supabaseService.getJobs(params)
        
        if (res.error) {
            console.error(res.error)
            return
        }
        
        tableData.value = res.data.items
        total.value = res.data.total
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

const handleSearch = () => {
    currentPage.value = 1
    fetchData()
}

const resetFilters = () => {
    filters.city = ''
    filters.level = ''
    filters.skill = ''
    filters.industry = ''
    filters.degree = ''
    filters.min_years = undefined
    handleSearch()
}

const handlePageChange = (val: number) => {
    currentPage.value = val
    fetchData()
}

const handleSizeChange = (val: number) => {
    pageSize.value = val
    currentPage.value = 1
    fetchData()
}

const viewDetail = (id: number) => {
    router.push(`/jobs/${id}`)
}

const handleCreate = async () => {
    isEdit.value = false
    form.value = {
        title: '',
        city_id: null,
        min_years: 0,
        level_id: null,
        degree_required_id: null,
        industry_id: null,
        salary_min: 0,
        salary_max: 0,
        description: '',
        required_skill_ids: [],
        nice_skill_ids: []
    }
    showDialog.value = true
    await nextTick()
    formRef.value?.clearValidate()
}

const handleEdit = async (row: JobDTO) => {
    isEdit.value = true
    form.value = {
        id: row.id,
        title: row.title,
        city_id: row.city_id,
        min_years: row.min_years,
        level_id: row.level_id,
        degree_required_id: row.degree_required_id,
        industry_id: row.industry_id,
        salary_min: row.salary_min,
        salary_max: row.salary_max,
        description: row.description,
        required_skill_ids: row.required_skill_ids || [],
        nice_skill_ids: row.nice_skill_ids || []
    }
    showDialog.value = true
    await nextTick()
    formRef.value?.clearValidate()
}

const handleDelete = async (row: JobDTO) => {
    try {
        await ElMessageBox.confirm('确定要删除该职位吗?', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })
        
        const { error } = await supabaseService.deleteJob(row.id)
        if (error) throw error
        
        ElMessage.success('删除成功')
        fetchData()
    } catch (e: any) {
        if (e !== 'cancel') {
             ElMessage.error('删除失败: ' + (e.message || e))
        }
    }
}

const saveJob = async () => {
    if (!formRef.value) return
    
    try {
        await formRef.value.validate()
    } catch (e) {
        ElMessage.warning('请检查表单填写是否完整')
        return
    }

    saving.value = true
    try {
        const payload = { ...form.value }
        // Ensure user_id is set for creation
        const { data: { user } } = await supabaseService.getUser()
        if (user) payload.user_id = user.id
        
        let res
        if (isEdit.value) {
            // Remove id from payload if update (handled by arg) or keep it, but updateJob takes id as arg
            delete payload.id
            res = await supabaseService.updateJob(form.value.id, payload)
        } else {
            res = await supabaseService.createJob(payload)
        }
        
        if (res.error) throw res.error
        
        ElMessage.success(isEdit.value ? '更新成功' : '发布成功')
        showDialog.value = false
        fetchData()
    } catch (e: any) {
        console.error(e)
        ElMessage.error('保存失败: ' + (e.message || e))
    } finally {
        saving.value = false
    }
}

const getScoreStatus = (score: number) => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'exception'
}

const showMatchMode = ref(false)
const currentJobTitle = ref('')

const handleSmartMatch = async (row: JobDTO) => {
    currentJobId.value = row.id
    currentJobTitle.value = row.title
    showMatchMode.value = true
    matches.value = []
    await loadMatches()
}

const closeMatchView = () => {
    showMatchMode.value = false
    matches.value = []
    currentJobId.value = null
}

const loadMatches = async () => {
    if (!currentJobId.value) return
    matchLoading.value = true
    try {
        // 1. Ensure matches exist
        const { error: ensureError } = await supabaseService.ensureJobMatchEvaluations(currentJobId.value)
        if (ensureError) throw ensureError

        // 2. Get matches
        // For now, fetch all (page 1, large size) or implement pagination in dialog
        const { data, error } = await supabaseService.getResumesForJob(currentJobId.value, { page: 1, pageSize: 20 })
        if (error) throw error
        
        matches.value = data.items

        // 3. Trigger LLM for missing scores
        matches.value.forEach(async (match) => {
            if (match.match_info.llm_score === null || match.match_info.llm_score === undefined) {
                try {
                    // Note: evaluateMatch takes (resumeId, jobId)
                    const { data: llmData, error: llmError } = await supabaseService.evaluateMatch(match.id, currentJobId.value!)
                    if (!llmError && llmData && llmData.success) {
                        match.match_info.llm_score = llmData.score
                        match.match_info.llm_reason = llmData.reason
                        // Update local state is enough as Vue reactivity will update UI
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        })

    } catch (e: any) {
        ElMessage.error('获取匹配失败: ' + (e.message || e))
    } finally {
        matchLoading.value = false
    }
}

onMounted(() => {
    metaStore.fetchMeta()
    fetchData()
})
</script>

<style scoped>
.page-container {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
}
.filter-bar {
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}
.header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
}
.el-select {
    width: 160px;
}
</style>
