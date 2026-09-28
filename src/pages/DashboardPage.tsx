import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Globe,
  Trash2,
  ExternalLink,
  Wrench,
  Lightbulb,
  Search,
  Bot,
  ChevronRight,
  FlaskConical,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { EmptyState, LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  Recommendation,
  Experiment,
  ProjectHealthReport,
  AutomationRunLog,
  Report,
} from '@/types'

export default function DashboardPage() {
  const api = useApi()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Intelligence & Health State
  const [projectHealth, setProjectHealth] = useState<ProjectHealthReport | null>(null)
  const [recentAutomationRuns, setRecentAutomationRuns] = useState<AutomationRunLog[]>([])
  const [latestReport, setLatestReport] = useState<Report | null>(null)
  const [activeExperiments, setActiveExperiments] = useState<Experiment[]>([])
  const [highPriorityRecs, setHighPriorityRecs] = useState<Recommendation[]>([])

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [industry, setIndustry] = useState('')

  const fetchDashboardData = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<ProjectListResponse>('/api/v1/projects')
      const projectList = data.projects || []
      setProjects(projectList)

      if (projectList.length > 0) {
        const activeProjId = selectedProjectId || projectList[0].id
        setSelectedProjectId(activeProjId)
        await loadProjectSpecificIntelligence(activeProjId)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const loadProjectSpecificIntelligence = async (projectId: string) => {
    try {
      const [health, runs, reports, recs, exps] = await Promise.all([
        api.get<ProjectHealthReport>(`/api/v1/projects/${projectId}/automation/health`).catch(() => null),
        api.get<AutomationRunLog[]>(`/api/v1/projects/${projectId}/automation/runs?limit=5`).catch(() => []),
        api.get<Report[]>(`/api/v1/projects/${projectId}/reports?limit=1`).catch(() => []),
        api.get<Recommendation[]>(`/api/v1/projects/${projectId}/recommendations`).catch(() => []),
        api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).catch(() => []),
      ])

      setProjectHealth(health)
      setRecentAutomationRuns(runs || [])
      setLatestReport(reports && reports.length > 0 ? reports[0] : null)
      setActiveExperiments((exps || []).filter((e) => ['measuring', 'running'].includes(e.status)))
      setHighPriorityRecs(
        (recs || []).filter((r) => r.priority === 'high' || r.priority === 'critical').slice(0, 4)
      )
    } catch {
      // Non-blocking for dashboard render
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId)
    loadProjectSpecificIntelligence(projId)
  }

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
      fetchDashboardData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return
    try {
      await api.delete(`/api/v1/projects/${id}`)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Intelligence Overview
          </h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            Holistic SEO performance, AI search visibility, recurring automation, and verified learning.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-[var(--color-text-primary)] shadow-sm focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Project
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger)] text-xs">
          {error}
        </div>
      )}

      {/* ── Section 1: Transparent Project Health (NO Arbitrary AI Score) ─ */}
      {projectHealth && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={14} className="text-[var(--color-primary-600)]" />
              Subsystem Health & Data Freshness
            </h2>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              No arbitrary combined score • Independent subsystem telemetry
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. SEO Audit Subsystem */}
            <Card className="p-3.5 border-t-2 border-t-blue-500">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Wrench size={13} className="text-blue-500" /> SEO Audit
                </span>
                <Badge variant={projectHealth.seo.is_fresh ? 'success' : 'neutral'} className="text-[9px]">
                  {projectHealth.seo.freshness_label}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-1">
                {projectHealth.seo.details || 'Technical crawl & schema'}
              </p>
            </Card>

            {/* 2. GEO Visibility Subsystem */}
            <Card className="p-3.5 border-t-2 border-t-indigo-500">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Bot size={13} className="text-indigo-500" /> AI Visibility (GEO)
                </span>
                <Badge variant={projectHealth.geo.is_fresh ? 'success' : 'neutral'} className="text-[9px]">
                  {projectHealth.geo.freshness_label}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-1">
                {projectHealth.geo.details || 'Multi-model citation checks'}
              </p>
            </Card>

            {/* 3. Search Console Subsystem */}
            <Card className="p-3.5 border-t-2 border-t-emerald-500">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Search size={13} className="text-emerald-500" /> Search Console
                </span>
                <Badge variant={projectHealth.gsc.is_fresh ? 'success' : 'neutral'} className="text-[9px]">
                  {projectHealth.gsc.freshness_label}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-1">
                {projectHealth.gsc.details || '48–72h standard latency'}
              </p>
            </Card>

            {/* 4. Automation Pipeline Subsystem */}
            <Card className="p-3.5 border-t-2 border-t-purple-500">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Clock size={13} className="text-purple-500" /> Automation
                </span>
                <Badge variant={projectHealth.automation.is_fresh ? 'success' : 'warning'} className="text-[9px]">
                  {projectHealth.automation.freshness_label}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-1">
                {projectHealth.automation.details || 'Scheduled pipelines running'}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ── Section 2: Main Grid: Recent Automation & Latest Report ─ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Recent Automation Execution Column */}
        <div className="md:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-[var(--color-primary-600)]" />
              Recent Automation Status
            </h2>
            <Link
              to="/settings/automation"
              className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline flex items-center gap-1"
            >
              Configure <ChevronRight size={11} />
            </Link>
          </div>

          <Card className="p-4 space-y-2.5">
            {recentAutomationRuns.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)] py-4 text-center">
                No recent automation runs recorded. Trigger jobs from the Automation settings page.
              </p>
            ) : (
              recentAutomationRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-xs"
                >
                  <div className="flex items-center gap-2">
                    {run.status === 'completed' ? (
                      <CheckCircle2 size={15} className="text-[var(--color-success)] shrink-0" />
                    ) : run.status === 'partial_success' ? (
                      <AlertTriangle size={15} className="text-[var(--color-warning)] shrink-0" />
                    ) : (
                      <Clock size={15} className="text-[var(--color-text-tertiary)] shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-[var(--color-text-primary)] capitalize">
                        {run.job_type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                        {run.is_manual ? 'Manual Trigger' : 'Scheduled Run'} • {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      run.status === 'completed'
                        ? 'success'
                        : run.status === 'partial_success'
                        ? 'warning'
                        : 'neutral'
                    }
                    className="text-[9px] capitalize"
                  >
                    {run.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Latest Intelligence Report Column */}
        <div className="md:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={13} className="text-[var(--color-primary-600)]" />
              Latest Intelligence Report
            </h2>
            <Link
              to="/reports"
              className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline flex items-center gap-1"
            >
              All reports <ChevronRight size={11} />
            </Link>
          </div>

          {latestReport ? (
            <Card className="p-4 border-l-4 border-l-[var(--color-primary-600)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text-primary)] capitalize">
                    {latestReport.report_type.replace('_', ' ')}
                  </span>
                  <Badge variant="neutral" className="text-[10px]">
                    {new Date(latestReport.created_at).toLocaleDateString()}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] mt-1">
                  <Calendar size={12} />
                  <span>
                    {new Date(latestReport.period_start).toLocaleDateString()} – {new Date(latestReport.period_end).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2.5 line-clamp-3 leading-relaxed bg-[var(--color-surface-secondary)] p-2.5 rounded border border-[var(--color-border)]">
                  {latestReport.summary}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                  GSC latency: ~48-72h • Multi-model verified
                </span>
                <Link to="/reports">
                  <Button size="sm" variant="outline">
                    View Full Report
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-xs text-[var(--color-text-tertiary)]">
              <FileText size={24} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
              No intelligence reports generated yet for this project.
              <div className="mt-3">
                <Link to="/reports">
                  <Button size="sm">Generate Report</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Section 3: High Priority Recommendations & Active Experiments ─ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* High-Priority Recommendations */}
        <div className="md:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb size={13} className="text-[var(--color-warning)]" />
              Important Recommendations ({highPriorityRecs.length})
            </h2>
            <Link
              to="/recommendations"
              className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline flex items-center gap-1"
            >
              Review all <ChevronRight size={11} />
            </Link>
          </div>

          <div className="space-y-2">
            {highPriorityRecs.length === 0 ? (
              <Card className="p-5 text-center text-xs text-[var(--color-text-tertiary)]">
                No high-priority recommendations pending review.
              </Card>
            ) : (
              highPriorityRecs.map((rec) => (
                <Card key={rec.id} className="p-3.5 hover:shadow-xs transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-[75%]">
                      {rec.title}
                    </span>
                    <Badge variant={rec.priority === 'critical' ? 'danger' : 'warning'} className="text-[9px]">
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-1">
                    {rec.action}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)]">
                    <span className="capitalize">{rec.type} • {rec.status}</span>
                    <Link to="/recommendations" className="text-[var(--color-primary-600)] font-medium hover:underline">
                      Inspect & Approve →
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Active Closed-Loop Experiments */}
        <div className="md:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
              <FlaskConical size={13} className="text-[var(--color-primary-600)]" />
              Active Measuring Experiments ({activeExperiments.length})
            </h2>
            <Link
              to="/experiments"
              className="text-[11px] font-semibold text-[var(--color-primary-600)] hover:underline flex items-center gap-1"
            >
              All experiments <ChevronRight size={11} />
            </Link>
          </div>

          <div className="space-y-2">
            {activeExperiments.length === 0 ? (
              <Card className="p-5 text-center text-xs text-[var(--color-text-tertiary)]">
                No active experiments measuring right now. Deploy approved recommendations as experiments.
              </Card>
            ) : (
              activeExperiments.map((exp) => (
                <Card key={exp.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-[70%]">
                      {exp.name}
                    </span>
                    <Badge variant="info" className="text-[9px]">
                      Measuring
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-1">
                    {exp.hypothesis}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)]">
                    <span>
                      Window: {exp.measurement_start ? new Date(exp.measurement_start).toLocaleDateString() : 'Active'} –{' '}
                      {exp.measurement_end ? new Date(exp.measurement_end).toLocaleDateString() : 'Ongoing'}
                    </span>
                    <Link to="/experiments" className="text-[var(--color-primary-600)] font-medium hover:underline">
                      View Deltas →
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Section 4: Tracked Websites List ─────────────────── */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Tracked Websites ({projects.length})
        </h2>

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
              <Card key={project.id} className="p-4 hover:shadow-xs transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] flex items-center justify-center shrink-0">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                        {project.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1 font-mono">
                        <ExternalLink size={10} />
                        {project.website_url}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link to={`/technical?project=${project.id}`}>
                      <Button size="sm" variant="outline">
                        <Wrench size={12} /> Audit
                      </Button>
                    </Link>
                    <Link to={`/seo?project=${project.id}`}>
                      <Button size="sm" variant="outline">
                        <Search size={12} /> Search Console
                      </Button>
                    </Link>
                    <Link to={`/geo?project=${project.id}`}>
                      <Button size="sm" variant="outline">
                        <Bot size={12} /> AI Visibility
                      </Button>
                    </Link>
                    <Link to={`/recommendations?project=${project.id}`}>
                      <Button size="sm" variant="primary">
                        <Lightbulb size={12} /> Recommendations
                      </Button>
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
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

      {/* Create Modal */}
      {showCreate && (
        <Card className="p-5">
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
    </div>
  )
}
