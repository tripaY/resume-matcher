<template>
  <div class="page-container">
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

    <!-- Edit Dialog Placeholder -->
    <el-dialog v-model="showDialog" :title="isEdit ? '编辑职位' : '发布职位'" width="60%">
        <el-form :model="form" label-width="100px">
            <el-form-item label="职位名称">
                <el-input v-model="form.title" />
            </el-form-item>
            <!-- More fields can be added here -->
            <div class="text-center text-gray-500 my-4">
                (更多表单项待完善...)
            </div>
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
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { JobDTO } from '../types/supabase'

const router = useRouter()
const metaStore = useMetaStore()
const loading = ref(false)
const tableData = ref<JobDTO[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// Dialog State
const showDialog = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const form = ref<any>({})

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

const handleCreate = () => {
    isEdit.value = false
    form.value = {
        title: '',
        city_id: null,
        min_years: 0,
        level_id: null,
        salary_min: 0,
        salary_max: 0
    }
    showDialog.value = true
}

const handleEdit = (row: JobDTO) => {
    isEdit.value = true
    // Need to fetch full detail or map DTO back to Form
    // For now, simple mapping
    form.value = { ...row }
    showDialog.value = true
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
    // Placeholder for save logic
    saving.value = true
    try {
        // Mock save delay
        await new Promise(resolve => setTimeout(resolve, 500))
        ElMessage.success('保存功能待完善 (需要完善表单)')
        showDialog.value = false
        fetchData()
    } finally {
        saving.value = false
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
