import { supabaseService } from './supabaseService'

// Adapter to match existing Axios API style if needed, 
// OR directly export supabaseService functions if they match the signature used in Views.

// Views usage:
// getMeta() -> { data: ... }
// getJobs(params) -> { data: { items: [], total: 0 } }
// getJobDetail(id) -> { data: ... }

// Since our supabaseService returns exactly { data: ..., error: ... }
// and we ensured the data structure inside matches what Views expect (e.g. items, total),
// we can just re-export.

// Data Fetching
export const getMeta = supabaseService.getMeta
export const getJobs = supabaseService.getJobs
export const getJobDetail = supabaseService.getJobDetail
export const getJobMatches = supabaseService.getJobMatches
export const getResumes = supabaseService.getResumes
export const getResumeDetail = supabaseService.getResumeDetail
export const getResumeMatches = supabaseService.getResumeMatches

// Auth
export const loginOrRegister = supabaseService.loginOrRegister
export const signOut = supabaseService.signOut
export const getUser = supabaseService.getUser

// Admin
export const updateDimension = supabaseService.updateDimension
export const createJob = supabaseService.createJob
export const updateJob = supabaseService.updateJob

// User
export const getMyResume = supabaseService.getMyResume
export const updateMyResume = supabaseService.updateMyResume
export const uploadAvatar = supabaseService.uploadAvatar

// LLM
export const callLLM = supabaseService.callLLM

export default supabaseService
