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
  Sparkles,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
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
  const [refreshing, setRefreshing] = useState(false)
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

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
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
      setRefreshing(false)
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
      fetchDashboardData(true)
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
    <div className="space-y-7 animate-fade-in max-w-7xl mx-auto">
      {/* ── Page Header & Project Selector ─────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Intelligence Overview
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 pulse-indicator" /> Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Holistic SEO performance, AI search visibility, recurring automation, and verified learning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {projects.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Project:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => handleSelectProject(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-900 cursor-pointer focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchDashboardData(true)}
            loading={refreshing}
            title="Refresh dashboard"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Project
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between animate-scale-in">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-semibold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Subsystem Health & Freshness Indicators (No fake composite score) ─ */}
      {projectHealth && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={14} className="text-blue-600" />
              Subsystem Health & Telemetry
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Transparent independent status • GSC 48–72h latency disclosed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. SEO Audit Subsystem */}
            <Card hoverLift className="border-t-2 border-t-blue-500 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Wrench size={14} className="text-blue-600" /> Technical SEO
                </span>
                <Badge variant={projectHealth.seo.is_fresh ? 'success' : 'neutral'} dot>
                  {projectHealth.seo.freshness_label}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 font-medium line-clamp-1">
                {projectHealth.seo.details || 'Crawl, directives & structured data'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Health Index</span>
                <Link
                  to={`/technical?project=${selectedProjectId}`}
                  className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Audit <ArrowUpRight size={11} />
                </Link>
              </div>
            </Card>

            {/* 2. GEO AI Visibility Subsystem */}
            <Card hoverLift className="border-t-2 border-t-purple-500 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Bot size={14} className="text-purple-600" /> AI Visibility (GEO)
                </span>
                <Badge variant={projectHealth.geo.is_fresh ? 'geo' : 'neutral'} dot>
                  {projectHealth.geo.freshness_label}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 font-medium line-clamp-1">
                {projectHealth.geo.details || 'Multi-model citation benchmarking'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">5 AI Engines</span>
                <Link
                  to={`/geo?project=${selectedProjectId}`}
                  className="text-purple-600 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Check <ArrowUpRight size={11} />
                </Link>
              </div>
            </Card>

            {/* 3. Search Console Subsystem */}
            <Card hoverLift className="border-t-2 border-t-emerald-500 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Search size={14} className="text-emerald-600" /> Search Console
                </span>
                <Badge variant={projectHealth.gsc.is_fresh ? 'success' : 'neutral'} dot>
                  {projectHealth.gsc.freshness_label}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 font-medium line-clamp-1">
                {projectHealth.gsc.details || 'Clicks, impressions & rankings'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">48-72h latency</span>
                <Link
                  to={`/seo?project=${selectedProjectId}`}
                  className="text-emerald-600 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Explore <ArrowUpRight size={11} />
                </Link>
              </div>
            </Card>

            {/* 4. Automation Pipeline Subsystem */}
            <Card hoverLift className="border-t-2 border-t-amber-500 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-600" /> Automation
                </span>
                <Badge variant={projectHealth.automation.is_fresh ? 'success' : 'warning'} dot>
                  {projectHealth.automation.freshness_label}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 font-medium line-clamp-1">
                {projectHealth.automation.details || '7 Autonomous scheduled jobs'}
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Active Engine</span>
                <Link
                  to="/settings/automation"
                  className="text-amber-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Configure <ArrowUpRight size={11} />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Main Grid: Recent Automation & Latest Report ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Automation Execution Column */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-blue-600" />
              Autonomous Run History
            </h2>
            <Link
              to="/settings/automation"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              Manage schedules <ChevronRight size={12} />
            </Link>
          </div>

          <Card padding="none" className="overflow-hidden">
            {recentAutomationRuns.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Clock size={22} className="mx-auto mb-2 text-slate-300" />
                No automation runs recorded yet. Jobs will execute per your schedule.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAutomationRuns.map((run) => (
                  <div
                    key={run.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {run.status === 'completed' ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={15} />
                        </div>
                      ) : run.status === 'partial_success' ? (
                        <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <AlertTriangle size={15} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <Clock size={15} />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-900 capitalize block">
                          {run.job_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{run.is_manual ? 'Manual' : 'Automated'}</span>
                          <span>•</span>
                          <span>
                            {new Date(run.started_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
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
                      className="text-[10px] capitalize"
                      dot
                    >
                      {run.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Latest Intelligence Report Column */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={13} className="text-blue-600" />
              Latest Intelligence Report
            </h2>
            <Link
              to="/reports"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              Report archive <ChevronRight size={12} />
            </Link>
          </div>

          {latestReport ? (
            <Card hoverLift className="border-l-4 border-l-blue-600 flex flex-col justify-between h-[calc(100%-2rem)]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 capitalize flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-600" />
                    {latestReport.report_type.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="neutral" className="text-[10px]">
                    {new Date(latestReport.created_at).toLocaleDateString()}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Calendar size={13} className="text-slate-400" />
                  <span>
                    {new Date(latestReport.period_start).toLocaleDateString()} –{' '}
                    {new Date(latestReport.period_end).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {latestReport.summary}
                </div>
              </div>

              <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
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
            <Card className="p-8 text-center text-xs text-slate-400">
              <FileText size={24} className="mx-auto mb-2 text-slate-300" />
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

      {/* ── High-Priority Recommendations & Active Experiments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* High-Priority Recommendations */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb size={13} className="text-amber-600" />
              Important Recommendations (
              <AnimatedNumber value={highPriorityRecs.length} />
              )
            </h2>
            <Link
              to="/recommendations"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              Review all <ChevronRight size={12} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {highPriorityRecs.length === 0 ? (
              <Card className="p-6 text-center text-xs text-slate-400">
                No high-priority recommendations pending review.
              </Card>
            ) : (
              highPriorityRecs.map((rec) => (
                <Card key={rec.id} hoverLift className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[75%]">
                      {rec.title}
                    </span>
                    <Badge variant={rec.priority === 'critical' ? 'danger' : 'warning'} className="text-[10px]">
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-1 leading-relaxed">
                    {rec.action}
                  </p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                    <span className="capitalize">{rec.type} • {rec.status}</span>
                    <Link
                      to={`/recommendations?project=${selectedProjectId}`}
                      className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                    >
                      Inspect & Approve →
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Active Closed-Loop Experiments */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FlaskConical size={13} className="text-blue-600" />
              Active Measuring Experiments (
              <AnimatedNumber value={activeExperiments.length} />
              )
            </h2>
            <Link
              to="/experiments"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              All experiments <ChevronRight size={12} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {activeExperiments.length === 0 ? (
              <Card className="p-6 text-center text-xs text-slate-400">
                No active experiments measuring right now. Deploy approved recommendations as experiments.
              </Card>
            ) : (
              activeExperiments.map((exp) => (
                <Card key={exp.id} hoverLift className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[70%]">
                      {exp.name}
                    </span>
                    <Badge variant="info" className="text-[10px]" dot>
                      Measuring
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                    {exp.hypothesis}
                  </p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                    <span>
                      Window:{' '}
                      {exp.measurement_start
                        ? new Date(exp.measurement_start).toLocaleDateString()
                        : 'Active'}{' '}
                      –{' '}
                      {exp.measurement_end
                        ? new Date(exp.measurement_end).toLocaleDateString()
                        : 'Ongoing'}
                    </span>
                    <Link
                      to={`/experiments?project=${selectedProjectId}`}
                      className="text-blue-600 font-semibold hover:underline"
                    >
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
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Globe size={13} className="text-blue-600" />
          Tracked Websites ({projects.length})
        </h2>

        {loading ? (
          <LoadingState message="Loading projects..." type="skeleton" />
        ) : projects.length === 0 ? (
          <Card>
            <EmptyState
              icon={
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Globe size={22} />
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
          <div className="grid grid-cols-1 gap-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                hoverLift
                className={`p-4 transition-all ${
                  project.id === selectedProjectId ? 'ring-2 ring-blue-500/20 border-blue-400' : ''
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
                      <Globe size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{project.name}</h3>
                        {project.id === selectedProjectId && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.2 rounded-full border border-blue-200">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                        <ExternalLink size={11} />
                        {project.website_url}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/technical?project=${project.id}`}>
                      <Button size="sm" variant="secondary">
                        <Wrench size={13} /> Audit
                      </Button>
                    </Link>
                    <Link to={`/seo?project=${project.id}`}>
                      <Button size="sm" variant="secondary">
                        <Search size={13} /> GSC
                      </Button>
                    </Link>
                    <Link to={`/geo?project=${project.id}`}>
                      <Button size="sm" variant="secondary">
                        <Bot size={13} /> GEO
                      </Button>
                    </Link>
                    <Link to={`/recommendations?project=${project.id}`}>
                      <Button size="sm" variant="primary">
                        <Lightbulb size={13} /> Recommendations
                      </Button>
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                      aria-label="Delete project"
                      title="Delete project"
                    >
                      <Trash2 size={15} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in">
          <Card className="w-full max-w-lg p-6 shadow-xl animate-scale-in">
            <h2 className="text-base font-bold text-slate-900 mb-1">Create a new project</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter your website details to begin traditional SEO and AI search intelligence tracking.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                id="project-name"
                label="Project name"
                placeholder="Acme Corporation"
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
              <Input
                id="project-industry"
                label="Industry (optional)"
                placeholder="e.g. SaaS, E-commerce, FinTech"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={creating}>
                  Create Project
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
