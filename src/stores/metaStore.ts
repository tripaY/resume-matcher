import { defineStore } from 'pinia'
import { supabaseService } from '../api/supabaseService'
import type { MetaData } from '../types/supabase'

export const useMetaStore = defineStore('meta', {
  state: (): { data: MetaData | null; loading: boolean; error: any } => ({
    data: null,
    loading: false,
    error: null
  }),
  
  getters: {
    cities: (state) => state.data?.cities || [],
    levels: (state) => state.data?.levels || [],
    skills: (state) => state.data?.skills || [],
    industries: (state) => state.data?.industries || [],
    degrees: (state) => state.data?.degrees || []
  },

  actions: {
    async fetchMeta() {
      if (this.data) return // Already loaded

      this.loading = true
      this.error = null
      
      const { data, error } = await supabaseService.getMeta()
      
      if (error) {
        this.error = error
      } else {
        this.data = data
      }
      
      this.loading = false
    }
  }
})
