<template>
  <div class="layout">
    <el-header class="header">
      <div class="logo">Resume Match Admin</div>
      <el-menu
        :default-active="activePath"
        mode="horizontal"
        router
        class="nav-menu"
        background-color="#545c64"
        text-color="#fff"
        active-text-color="#ffd04b"
      >
        <el-menu-item index="/resumes">人才库 (Candidates)</el-menu-item>
        <el-menu-item index="/jobs">职位管理 (Jobs)</el-menu-item>
      </el-menu>
    </el-header>
    <el-main class="main-content">
      <router-view />
    </el-main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activePath = computed(() => {
  if (route.path.startsWith('/resumes')) return '/resumes'
  if (route.path.startsWith('/jobs')) return '/jobs'
  return route.path
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 0 20px;
  background-color: #545c64;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  color: #fff;
  font-size: 20px;
  font-weight: bold;
  margin-right: 40px;
}

.nav-menu {
  flex: 1;
  border-bottom: none !important;
}

.main-content {
  padding: 20px;
  background-color: #f5f7fa;
  flex: 1;
}
</style>
