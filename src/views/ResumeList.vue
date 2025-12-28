<template>
  <div class="page-container">
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
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="scope">
          <el-button type="primary" size="small" @click="viewDetail(scope.row.id)">
            详情 & 匹配
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'
import type { ResumeDTO } from '../types/supabase'

const router = useRouter()
const metaStore = useMetaStore()
const loading = ref(false)
const tableData = ref<ResumeDTO[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

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

const viewDetail = (id: number) => {
    router.push(`/resumes/${id}`)
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
</style>
