<template>
  <div class="page-container">
    <h2>系统配置</h2>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="行业管理" name="industries">
        <config-table 
          type="industries" 
          :data="metaStore.industries" 
          @refresh="refreshData"
        />
      </el-tab-pane>
      <el-tab-pane label="技能管理" name="skills">
        <config-table 
          type="skills" 
          :data="metaStore.skills" 
          @refresh="refreshData"
        />
      </el-tab-pane>
      <el-tab-pane label="城市管理" name="cities">
        <config-table 
          type="cities" 
          :data="metaStore.cities" 
          @refresh="refreshData"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMetaStore } from '../stores/metaStore'
import ConfigTable from '../components/ConfigTable.vue'

const metaStore = useMetaStore()
const activeTab = ref('industries')

const refreshData = () => {
  metaStore.fetchMeta()
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.page-container {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
}
</style>