import { describe, it, expect } from 'vitest'
import { transformJob } from '../supabaseService'

describe('Supabase Transformers', () => {
  it('should transform raw job data to JobDTO correctly', () => {
    const rawJob = {
      id: 1,
      title: 'Frontend Engineer',
      min_years: 3,
      salary_min: 20000,
      salary_max: 30000,
      description: 'Vue 3 expert needed',
      cities: { name: 'Shanghai' },
      career_levels: { name: 'Senior' },
      degrees: { name: 'Bachelor' },
      industries: { name: 'Internet' },
      job_skills: [
        { is_required: true, skills: { name: 'Vue' } },
        { is_required: true, skills: { name: 'TypeScript' } },
        { is_required: false, skills: { name: 'Node.js' } }
      ]
    }

    const expected = {
      id: 1,
      title: 'Frontend Engineer',
      city: 'Shanghai',
      min_years: 3,
      level: 'Senior',
      salary_min: 20000,
      salary_max: 30000,
      degree: 'Bachelor',
      degree_required: 'Bachelor',
      industry: 'Internet',
      required_skills: ['Vue', 'TypeScript'],
      nice_to_have_skills: ['Node.js'],
      description: 'Vue 3 expert needed'
    }

    const result = transformJob(rawJob)
    expect(result).toEqual(expected)
  })

  it('should handle missing optional fields gracefully', () => {
    const rawJob = {
      id: 2,
      title: 'Backend Engineer',
      // Missing relations
    }

    const result = transformJob(rawJob)
    
    expect(result.city).toBe('Unknown')
    expect(result.level).toBe('Unknown')
    expect(result.required_skills).toEqual([])
  })
})
