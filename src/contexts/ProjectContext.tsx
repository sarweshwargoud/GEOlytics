import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useApi } from '@/hooks/useApi'
import { useAuth } from '@/contexts/AuthContext'
import type { Project, ProjectListResponse } from '@/types'

const STORAGE_KEY = 'geolytics_active_project_id'

interface ProjectContextType {
  projects: Project[]
  selectedProjectId: string
  selectedProject: Project | undefined
  loadingProjects: boolean
  setSelectedProjectId: (id: string) => void
  createProject: (data: { name: string; website_url: string; industry?: string }) => Promise<Project>
  refreshProjects: (preferId?: string) => Promise<Project[]>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true)

  const refreshProjects = useCallback(async (preferId?: string): Promise<Project[]> => {
    if (!user) {
      setProjects([])
      setSelectedProjectIdState('')
      setLoadingProjects(false)
      return []
    }

    try {
      const res = await api.get<ProjectListResponse>('/api/v1/projects')
      const items = res.projects || []
      setProjects(items)

      // Determine active project ID
      const urlProjId = searchParams.get('project') || searchParams.get('projectId')
      const storedProjId = localStorage.getItem(STORAGE_KEY)

      let activeId = ''
      if (preferId && items.some((p) => p.id === preferId)) {
        activeId = preferId
      } else if (urlProjId && items.some((p) => p.id === urlProjId)) {
        activeId = urlProjId
      } else if (storedProjId && items.some((p) => p.id === storedProjId)) {
        activeId = storedProjId
      } else if (items.length > 0) {
        activeId = items[0].id
      }

      if (activeId) {
        setSelectedProjectIdState(activeId)
        localStorage.setItem(STORAGE_KEY, activeId)
        // Ensure URL query parameter is set if missing
        if (!urlProjId && location.pathname !== '/login') {
          const newParams = new URLSearchParams(searchParams)
          newParams.set('project', activeId)
          setSearchParams(newParams, { replace: true })
        }
      }

      return items
    } catch (err) {
      console.error('[ProjectContext] Failed to load projects:', err)
      return []
    } finally {
      setLoadingProjects(false)
    }
  }, [user, api, searchParams, setSearchParams, location.pathname])

  // Sync when user changes or on initial mount
  useEffect(() => {
    refreshProjects()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync if URL search params change externally
  useEffect(() => {
    const urlProjId = searchParams.get('project') || searchParams.get('projectId')
    if (urlProjId && urlProjId !== selectedProjectId && projects.some((p) => p.id === urlProjId)) {
      setSelectedProjectIdState(urlProjId)
      localStorage.setItem(STORAGE_KEY, urlProjId)
    }
  }, [searchParams, projects, selectedProjectId])

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('project', id)
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const createProject = useCallback(async (data: {
    name: string
    website_url: string
    industry?: string
  }): Promise<Project> => {
    const newProject = await api.post<Project>('/api/v1/projects', data)
    
    // Update local state with the new project at the top
    setProjects((prev) => [newProject, ...prev.filter((p) => p.id !== newProject.id)])
    setSelectedProjectIdState(newProject.id)
    localStorage.setItem(STORAGE_KEY, newProject.id)

    // Redirect to project dashboard with new project ID in URL
    navigate(`/dashboard?project=${newProject.id}`)

    return newProject
  }, [api, navigate])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProjectId,
        selectedProject,
        loadingProjects,
        setSelectedProjectId,
        createProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
