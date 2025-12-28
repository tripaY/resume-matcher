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

// Frontend Display Models (DTOs)
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
  educations?: any[]
}

export interface MetaData {
  cities: string[]
  levels: string[]
  skills: string[]
  industries: string[]
  degrees: string[]
}
