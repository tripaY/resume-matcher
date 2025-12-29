import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // ✅ 1. 配置基础路径 base (你的 Gitee 仓库名称)
  base: '/resume-matcher/', 
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // ✅ 2. 配置打包输出目录
  build: {
    outDir: 'docs'
  }
})
