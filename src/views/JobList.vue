<template>
  <div class="page-container">
    <div class="filter-bar">
      <el-form :inline="true" :model="filters" class="demo-form-inline">
        <el-form-item label="城市">
          <el-select v-model="filters.city" placeholder="选择城市" clearable>
            <el-option v-for="c in meta.cities" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="职级">
          <el-select v-model="filters.level" placeholder="选择职级" clearable>
            <el-option v-for="l in meta.levels" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能">
          <el-select v-model="filters.skill" placeholder="要求技能" clearable>
             <el-option v-for="s in meta.skills" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="行业">
          <el-select v-model="filters.industry" placeholder="所属行业" clearable>
             <el-option v-for="i in meta.industries" :key="i" :label="i" :value="i" />
          </el-select>
        </el-form-item>
         <el-form-item label="学历要求">
          <el-select v-model="filters.degree" placeholder="学历要求" clearable>
             <el-option v-for="d in meta.degrees" :key="d" :label="d" :value="d" />
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
       <el-table-column label="必需技能" min-width="200">
          <template #default="scope">
              <el-tag v-for="s in scope.row.required_skills.slice(0,3)" :key="s" size="small" class="mr-1" type="warning">{{ s }}</el-tag>
              <span v-if="scope.row.required_skills.length > 3">...</span>
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
import { getJobs, getMeta } from '../api'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const meta = reactive({
    cities: [],
    levels: [],
    skills: [],
    industries: [],
    degrees: []
})

const filters = reactive({
    city: '',
    level: '',
    skill: '',
    industry: '',
    degree: '',
    max_years_required: undefined
})

const fetchMeta = async () => {
    try {
        const res = await getMeta()
        Object.assign(meta, res.data)
    } catch (e) {
        console.error(e)
    }
}

const fetchData = async () => {
    loading.value = true
    try {
        const params = {
            ...filters,
            skip: (currentPage.value - 1) * pageSize.value,
            limit: pageSize.value
        }
        Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === undefined) {
                delete params[key]
            }
        })
        
        const res = await getJobs(params)
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
    filters.max_years_required = undefined
    handleSearch()
}

const handlePageChange = (val: number) => {
    currentPage.value = val
    fetchData()
}

const viewDetail = (id: number) => {
    router.push(`/jobs/${id}`)
}

onMounted(() => {
    fetchMeta()
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
.mr-1 {
    margin-right: 4px;
}
.pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
}
</style>
