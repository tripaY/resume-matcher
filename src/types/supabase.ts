export interface City {
  id: number
  name: string
  code?: string
}

export interface CareerLevel {
  id: number
  name: string
  label: string
  level: number
}

export interface Industry {
  id: number
  name: string
  code?: string
}

export interface Skill {
  id: number
  name: string
}

export interface Degree {
  id: number
  name: string
  level: number
}

export interface Profile {
  id: string // UUID matching auth.users
  role_id: string
  avatar_id?: string | null // UUID referencing storage.objects
  created_at?: string
  updated_at?: string
}

// DB Row Interfaces (Directly mapping to DB tables)
export interface Job {
  id: number
  user_id: string
  title: string
  city_id: number | null
  min_years: number
  level_id: number | null
  degree_required_id: number | null
  industry_id: number | null
  salary_min: number | null
  salary_max: number | null
  created_at?: string
  updated_at?: string
}

export interface Resume {
  id: number
  user_id: string
  candidate_name: string
  gender: 'M' | 'F' | null
  expected_city_id: number | null
  years_of_experience: number
  current_level_id: number | null
  expected_title: string | null
  expected_salary_min: number | null
  expected_salary_max: number | null
  created_at?: string
  updated_at?: string
}

// Frontend Display Models (DTOs) - Kept for View compatibility
export interface JobDTO {
  id: number
  title: string
  city: string
  min_years: number
  level: string
  salary_min: number
  salary_max: number
  required_skills: string[]
  nice_to_have_skills: string[]
  degree: string
  degree_required: string // Alias
  industry: string
  description?: string
}

export interface ResumeDTO {
  id: number
  name: string
  candidate_name: string // Alias
  city: string
  expected_city: string // Alias
  years: number
  years_of_experience: number // Alias
  level: string
  current_level: string // Alias
  salary_min: number
  salary_max: number
  skills: string[]
  degree: string
  gender?: string
  avatar_url?: string | null // Computed from Profile
  educations?: any[]
}

export interface MetaData {
  cities: City[]
  levels: CareerLevel[]
  skills: Skill[]
  industries: Industry[]
  degrees: Degree[]
}
