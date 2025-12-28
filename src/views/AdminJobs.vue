<template>
  <div class="admin-jobs-container">
    <div class="header mb-20">
      <h2>岗位管理</h2>
      <el-button type="primary" @click="openDialog('create')">发布新岗位</el-button>
    </div>

    <!-- Filters -->
    <div class="filters mb-20">
        <el-input v-model="filters.keyword" placeholder="搜索岗位" style="width: 200px" class="mr-2" />
        <el-select v-model="filters.city" placeholder="城市" clearable class="mr-2">
             <el-option v-for="c in meta.cities" :key="c.id" :label="c.name" :value="c.name" />
        </el-select>
        <el-button @click="loadJobs">查询</el-button>
    </div>

    <!-- Table -->
    <el-table :data="jobs" v-loading="loading" border style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="岗位名称" min-width="150" />
      <el-table-column prop="city" label="城市" width="100" />
      <el-table-column label="薪资范围" width="150">
          <template #default="{ row }">
              {{ row.salary_min }} - {{ row.salary_max }}
          </template>
      </el-table-column>
      <el-table-column prop="min_years" label="经验要求" width="100">
          <template #default="{ row }">≥ {{ row.min_years }}年</template>
      </el-table-column>
      <el-table-column prop="level" label="职级" width="100" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog('edit', row)">编辑</el-button>
          <el-button size="small" @click="$router.push(`/jobs/${row.id}`)">查看</el-button>
          <el-popconfirm title="确定删除该岗位吗？" @confirm="handleDelete(row.id)">
            <template #reference>
              <el-button size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div class="pagination mt-20">
      <el-pagination 
        background 
        layout="prev, pager, next" 
        :total="total" 
        :page-size="pageSize"
        @current-change="handlePageChange"
      />
    </div>

    <!-- Edit/Create Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '发布新岗位' : '编辑岗位'" width="600px">
        <el-form :model="form" label-width="100px">
            <el-form-item label="岗位名称">
                <el-input v-model="form.title" />
            </el-form-item>
            <el-form-item label="城市">
                <el-select v-model="form.city_id">
                    <el-option v-for="c in meta.cities" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="行业">
                <el-select v-model="form.industry_id">
                    <el-option v-for="i in meta.industries" :key="i.id" :label="i.name" :value="i.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="职级">
                <el-select v-model="form.career_level_id">
                    <el-option v-for="l in meta.levels" :key="l.id" :label="l.name" :value="l.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="最低学历">
                <el-select v-model="form.degree_id">
                    <el-option v-for="d in meta.degrees" :key="d.id" :label="d.name" :value="d.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="经验要求">
                <el-input-number v-model="form.min_years" :min="0" /> 年
            </el-form-item>
            <el-form-item label="薪资范围">
                <el-input-number v-model="form.salary_min" :step="1000" placeholder="Min" /> - 
                <el-input-number v-model="form.salary_max" :step="1000" placeholder="Max" />
            </el-form-item>
            <el-form-item label="必修技能">
                <el-select v-model="form.required_skill_ids" multiple filterable placeholder="选择必修技能">
                    <el-option v-for="s in meta.skills" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="加分技能">
                <el-select v-model="form.nice_skill_ids" multiple filterable placeholder="选择加分技能(非必须)">
                    <el-option v-for="s in meta.skills" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="职位描述">
                <el-input v-model="form.description" type="textarea" :rows="4" />
            </el-form-item>
        </el-form>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
            </span>
        </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { ElMessage } from 'element-plus'

const metaStore = useMetaStore()
const meta = computed(() => metaStore.meta)

const loading = ref(false)
const jobs = ref([])
const total = ref(0)
const pageSize = 10
const currentPage = ref(1)

const filters = ref({
    keyword: '',
    city: ''
})

// Dialog
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const form = ref<any>({})

const loadJobs = async () => {
    loading.value = true
    const params = {
        page: currentPage.value,
        pageSize: pageSize,
        city: filters.value.city || undefined
        // Keyword search not implemented in API yet, skipping
    }
    
    const { data, error } = await supabaseService.getJobs(params)
    if (!error) {
        jobs.value = data.items
        total.value = data.total
    }
    loading.value = false
}

const handlePageChange = (page: number) => {
    currentPage.value = page
    loadJobs()
}

const openDialog = (mode: 'create' | 'edit', row?: any) => {
    dialogMode.value = mode
    if (mode === 'edit' && row) {
        // Need to map row DTO back to Form IDs
        // This is tricky because DTO has names, but Form needs IDs.
        // And DTO doesn't have all IDs.
        // We should fetch job detail to get IDs properly.
        fetchJobDetailForEdit(row.id)
    } else {
        form.value = {
            title: '',
            min_years: 0,
            salary_min: 0,
            salary_max: 0,
            required_skill_ids: [],
            nice_skill_ids: []
        }
        dialogVisible.value = true
    }
}

const fetchJobDetailForEdit = async (id: number) => {
    const { data: job } = await supabaseService.getJobDetail(id)
    if (job) {
        // We need raw IDs. transformJob returns names.
        // Wait, supabaseService.getJobDetail returns DTO.
        // We need a raw fetch or reverse lookup.
        // Let's use reverse lookup from meta since we have it.
        
        // Actually, let's just cheat and fetch raw data here for simplicity?
        // Or update DTO to include IDs?
        // Let's reverse lookup for now.
        
        form.value = {
            id: job.id,
            title: job.title,
            description: job.description,
            min_years: job.min_years,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            city_id: meta.value.cities.find((c: any) => c.name === job.city)?.id,
            industry_id: meta.value.industries.find((i: any) => i.name === job.industry)?.id,
            career_level_id: meta.value.levels.find((l: any) => l.name === job.level)?.id,
            degree_id: meta.value.degrees.find((d: any) => d.name === job.degree_required)?.id,
            required_skill_ids: (job.required_skills || []).map((name: string) => meta.value.skills.find((s: any) => s.name === name)?.id).filter(Boolean) as number[],
            nice_skill_ids: (job.nice_to_have_skills || []).map((name: string) => meta.value.skills.find((s: any) => s.name === name)?.id).filter(Boolean) as number[]
        }
        dialogVisible.value = true
    }
}

const handleSave = async () => {
    saving.value = true
    try {
        // Prepare payload
        const payload = {
            title: form.value.title,
            city_id: form.value.city_id,
            industry_id: form.value.industry_id,
            career_level_id: form.value.career_level_id,
            degree_id: form.value.degree_id,
            min_years: form.value.min_years,
            salary_min: form.value.salary_min,
            salary_max: form.value.salary_max,
            description: form.value.description,
            required_skill_ids: form.value.required_skill_ids,
            nice_skill_ids: form.value.nice_skill_ids
        }
        
        let res
        if (dialogMode.value === 'create') {
            res = await supabaseService.createJob(payload)
        } else {
            res = await supabaseService.updateJob(form.value.id, payload)
        }
        
        if (res.error) throw res.error
        
        ElMessage.success('保存成功')
        dialogVisible.value = false
        loadJobs()
    } catch (e: any) {
        ElMessage.error('保存失败: ' + e.message)
    } finally {
        saving.value = false
    }
}

const handleDelete = async (id: number) => {
    const { error } = await supabaseService.deleteJob(id)
    if (!error) {
        ElMessage.success('删除成功')
        loadJobs()
    } else {
        ElMessage.error('删除失败')
    }
}

onMounted(() => {
    metaStore.fetchMeta()
    loadJobs()
})
</script>

<style scoped>
.admin-jobs-container {
    padding: 20px;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.mb-20 { margin-bottom: 20px; }
.mt-20 { margin-top: 20px; }
.mr-2 { margin-right: 10px; }
</style>