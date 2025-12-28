import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: './', // For Gitee Pages or relative path deployment
  plugins: [vue()],
  // Proxy is no longer needed as we use Supabase client directly
})
