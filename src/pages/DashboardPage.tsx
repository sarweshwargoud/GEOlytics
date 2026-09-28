import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Globe, Trash2, ExternalLink, Wrench } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { EmptyState, LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type { Project, ProjectListResponse } from '@/types'

export default function DashboardPage() {
  const api = useApi()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [industry, setIndustry] = useState('')

  const fetchProjects = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<ProjectListResponse>('/api/v1/projects')
      setProjects(data.projects)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/api/v1/projects', {
        name: name.trim(),
        website_url: url.trim(),
        industry: industry.trim() || undefined,
      })
      setName('')
      setUrl('')
      setIndustry('')
      setShowCreate(false)
      fetchProjects()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return
    try {
      await api.del(`/api/v1/projects/${id}`)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Overview
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage your SEO + GEO intelligence projects
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Project
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
            Create a new project
          </h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                id="project-name"
                label="Project name"
                placeholder="My Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                id="project-url"
                label="Website URL"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <Input
              id="project-industry"
              label="Industry (optional)"
              placeholder="e.g. SaaS, E-commerce, Healthcare"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" loading={creating}>
                Create Project
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger)] text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading projects..." />
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
                <Globe size={24} className="text-[var(--color-primary-600)]" />
              </div>
            }
            title="Create your first SEO project"
            description="Add a website to start analyzing its traditional search performance and AI search visibility."
            action={
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> New Project
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id} padding="sm">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                  <Globe size={16} className="text-[var(--color-primary-600)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {project.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate flex items-center gap-1">
                    <ExternalLink size={10} />
                    {project.website_url}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {project.industry && (
                    <Badge variant="info">{project.industry}</Badge>
                  )}
                  <Link to={`/technical?projectId=${project.id}`}>
                    <Button size="sm" variant="secondary">
                      <Wrench size={13} /> Audit
                    </Button>
                  </Link>
                  <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:inline">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] transition-colors"
                    aria-label="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
