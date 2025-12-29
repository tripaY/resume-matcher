<template>
  <div class="page-container">
    <!-- Main Resume List View -->
    <div v-if="!showMatchMode">
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
            <el-select v-model="filters.skill" placeholder="具备技能" clearable>
               <el-option v-for="s in metaStore.skills" :key="s.id" :label="s.name" :value="s.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="行业">
            <el-select v-model="filters.industry" placeholder="行业背景" clearable>
               <el-option v-for="i in metaStore.industries" :key="i.id" :label="i.name" :value="i.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="学历">
            <el-select v-model="filters.degree" placeholder="最低学历" clearable>
               <el-option v-for="d in metaStore.degrees" :key="d.id" :label="d.name" :value="d.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="最低年限">
             <el-input-number v-model="filters.min_years" :min="0" :max="20" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">筛选</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="tableData" v-loading="loading" style="width: 100%" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="candidate_name" label="姓名" width="120" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="expected_city" label="期望城市" width="100" />
        <el-table-column prop="years_of_experience" label="年限" width="80">
            <template #default="scope">
                {{ scope.row.years_of_experience }}年
            </template>
        </el-table-column>
        <el-table-column prop="current_level" label="当前职级" width="100">
            <template #default="scope">
                <el-tag>{{ scope.row.current_level }}</el-tag>
            </template>
        </el-table-column>
         <el-table-column label="技能" min-width="200">
            <template #default="scope">
                <el-tag v-for="s in scope.row.skills.slice(0,3)" :key="s" size="small" class="mr-1">{{ s }}</el-tag>
                <span v-if="scope.row.skills.length > 3">...</span>
            </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="viewDetail(scope.row.id)">
              详情
            </el-button>
            <el-button type="primary" size="small" @click="handleSmartMatch(scope.row)">
              智能匹配
            </el-button>
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
                <h2 class="m-0">岗位匹配结果: {{ currentCandidateName }}</h2>
            </div>
        </div>

        <el-table :data="matches" v-loading="matchLoading" style="width: 100%" stripe border>
            <el-table-column label="匹配度" width="100" align="center">
                <template #default="scope">
                     <el-progress type="circle" :percentage="scope.row.match_info?.score || 0" :width="50" :status="getScoreStatus(scope.row.match_info?.score || 0)" />
                </template>
            </el-table-column>
            
            <el-table-column prop="title" label="职位名称" width="180">
                <template #default="scope">
                    <div class="font-bold">{{ scope.row.title }}</div>
                </template>
            </el-table-column>

            <el-table-column prop="city" label="城市" width="100" />
            
            <el-table-column label="要求年限" width="100">
                <template #default="scope">
                    {{ scope.row.min_years }}年
                </template>
            </el-table-column>

            <el-table-column label="学历要求" width="120">
                 <template #default="scope">
                    {{ scope.row.degree_required }}
                </template>
            </el-table-column>

            <el-table-column label="薪资范围" width="150">
                <template #default="scope">
                    {{ scope.row.salary_min }}-{{ scope.row.salary_max }}
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
                    <el-button type="primary" link @click="router.push(`/jobs/${scope.row.id}`)">
                        查看详情
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import type { ResumeDTO } from '../types/supabase'

const router = useRouter()
const metaStore = useMetaStore()
const loading = ref(false)
const tableData = ref<ResumeDTO[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// Match View State
const showMatchMode = ref(false)
const matchLoading = ref(false)
const matches = ref<any[]>([])
const currentCandidateId = ref<number | null>(null)
const currentCandidateName = ref('')

const filters = reactive({
    city: '',
    level: '',
    skill: '',
    industry: '',
    degree: '',
    min_years: 0
})

const loadData = async () => {
    loading.value = true
    const params: any = {
        page: currentPage.value,
        pageSize: pageSize.value,
        ...filters
    }
    // Clean params
    Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === 0 || params[key] === undefined) {
            delete params[key]
        }
    })

    const { data, error } = await supabaseService.getResumes(params)
    if (error) {
        console.error(error)
    } else {
        tableData.value = data.items
        total.value = data.total
    }
    loading.value = false
}

const handleSearch = () => {
    currentPage.value = 1
    loadData()
}

const resetFilters = () => {
    filters.city = ''
    filters.level = ''
    filters.skill = ''
    filters.industry = ''
    filters.degree = ''
    filters.min_years = 0
    handleSearch()
}

const handlePageChange = (val: number) => {
    currentPage.value = val
    loadData()
}

const handleSizeChange = (val: number) => {
    pageSize.value = val
    currentPage.value = 1
    loadData()
}

const viewDetail = (id: number) => {
    router.push(`/resumes/${id}`)
}

const handleSmartMatch = async (row: ResumeDTO) => {
    currentCandidateId.value = row.id
    currentCandidateName.value = row.candidate_name
    showMatchMode.value = true
    matches.value = []
    await loadMatches()
}

const closeMatchView = () => {
    showMatchMode.value = false
    matches.value = []
    currentCandidateId.value = null
}

const loadMatches = async () => {
    if (!currentCandidateId.value) return
    matchLoading.value = true
    try {
        // 1. Ensure matches exist
        const { error: ensureError } = await supabaseService.ensureMatchEvaluations(currentCandidateId.value)
        if (ensureError) throw ensureError

        // 2. Get matches
        const { data, error } = await supabaseService.getJobsForResume(currentCandidateId.value, { page: 1, pageSize: 20 })
        if (error) throw error
        
        matches.value = data.items

        // 3. Trigger LLM for missing scores
        matches.value.forEach(async (match) => {
            if (match.match_info.llm_score === null || match.match_info.llm_score === undefined) {
                try {
                    // Note: evaluateMatch takes (resumeId, jobId)
                    const { data: llmData, error: llmError } = await supabaseService.evaluateMatch(currentCandidateId.value!, match.id)
                    if (!llmError && llmData && llmData.success) {
                        match.match_info.llm_score = llmData.score
                        match.match_info.llm_reason = llmData.reason
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

const getScoreStatus = (score: number) => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'exception'
}

onMounted(() => {
    loadData()
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
.mr-1 {
    margin-right: 4px;
}
.pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
}
.el-select {
    width: 160px;
}
.el-input-number {
    width: 160px;
}
</style>
