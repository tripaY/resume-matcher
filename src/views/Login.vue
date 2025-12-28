<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-area">
        <h1>Resume Matcher</h1>
        <p class="subtitle">企业级智能招聘系统</p>
      </div>
      
      <div class="form-area">
        <div class="input-group">
          <el-input 
            v-model="username" 
            placeholder="用户名" 
            size="large"
            @keyup.enter="focusPassword"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </div>
        
        <div class="input-group">
          <el-input 
            ref="passwordInput"
            v-model="password" 
            type="password" 
            placeholder="密码" 
            size="large"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="actions">
          <el-button 
            type="primary" 
            size="large" 
            :loading="loading" 
            class="action-btn"
            @click="handleLogin"
          >
            进入系统
          </el-button>
        </div>

        <p class="hint">如果是新用户，系统将自动为您注册。</p>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { supabaseService } from '../api/supabaseService'
import { useMetaStore } from '../stores/metaStore'

const router = useRouter()
const metaStore = useMetaStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const passwordInput = ref()

const focusPassword = () => {
  passwordInput.value?.focus()
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    const { user, error } = await supabaseService.loginOrRegister(username.value, password.value)
    
    if (error) {
      errorMsg.value = error.message
    } else if (user) {
      // Login success
      // Fetch meta data
      await metaStore.fetchMeta()
      
      // Determine redirect based on role (TODO: add role check)
      // For now, redirect to appropriate view or home
      // Checking role from profile would be ideal, but for now let's go to root which redirects
      router.push('/')
    }
  } catch (e: any) {
    errorMsg.value = e.message || '登录发生未知错误'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.logo-area {
  margin-bottom: 40px;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  font-size: 14px;
}

.form-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.actions {
  margin-top: 10px;
}

.action-btn {
  width: 100%;
  font-weight: 500;
}

.hint {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 16px;
}

.error-msg {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 8px;
}
</style>
