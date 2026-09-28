import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Play,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Layers,
  Search,
  Bot,
  Wrench,
  Globe,
  Lightbulb,
  FlaskConical,
  FileText,
  Activity,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  AutomationJobSetting,
  AutomationRunLog,
  AutomationJobType,
  AutomationFrequency,
} from '@/types'

const JOB_METADATA: Record<
  AutomationJobType,
  { title: string; description: string; defaultFrequency: string; icon: any }
> = {
  seo_sync: {
    title: 'Google Search Console Sync',
    description: 'Refreshes search performance, clicks, impressions, CTR, and average positions from GSC.',
    defaultFrequency: 'Daily',
    icon: Search,
  },
  geo_checks: {
    title: 'GEO Visibility Checks',
    description: 'Probes connected AI search models (OpenAI, Gemini, Grok, Claude) to verify brand citations.',
    defaultFrequency: 'Daily',
    icon: Bot,
  },
  seo_audit: {
    title: 'Website SEO Audit',
    description: 'Crawls website pages, analyzes robots.txt, schema markup, and calculates SEO health metrics.',
    defaultFrequency: 'Weekly',
    icon: Wrench,
  },
  competitor_research: {
    title: 'Competitor Intelligence',
    description: 'Uses Tavily web groundings to detect competitor content shifts and comparison matrices.',
    defaultFrequency: 'Weekly',
    icon: Globe,
  },
  agent_analysis: {
    title: 'LangGraph Reasoning Agent',
    description: 'Executes the 9-node reasoning graph synthesizing latest SEO, GEO, and memory patterns into actionable opportunities.',
    defaultFrequency: 'Weekly',
    icon: Lightbulb,
  },
  experiment_measurement: {
    title: 'Experiment Measurement',
    description: 'Checks running SEO/GEO experiments, gathers before-vs-after delta metrics, and records learnings in Hindsight.',
    defaultFrequency: 'Daily',
    icon: FlaskConical,
  },
  report_generation: {
    title: 'Weekly Intelligence Report',
    description: 'Compiles periodic performance summaries across traditional search, AI search, experiments, and learnings.',
    defaultFrequency: 'Weekly',
    icon: FileText,
  },
}

export default function AutomationSettingsPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [settings, setSettings] = useState<AutomationJobSetting[]>([])
  const [runs, setRuns] = useState<AutomationRunLog[]>([])
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 1. Load user projects
  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true)
      try {
        const res = await api.get<ProjectListResponse>('/api/v1/projects')
        const items = res.projects || []
        setProjects(items)
        const qpId = searchParams.get('projectId') || searchParams.get('project')
        if (qpId && items.some((p) => p.id === qpId)) {
          setSelectedProjectId(qpId)
        } else if (items.length > 0) {
          setSelectedProjectId(items[0].id)
        }
      } catch (err: unknown) {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to load projects',
        })
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Load automation settings & recent runs
  useEffect(() => {
    if (!selectedProjectId) return
    loadAutomationData(selectedProjectId)
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAutomationData = async (projectId: string) => {
    setLoadingSettings(true)
    setStatusMessage(null)
    try {
      const [settingsData, runsData] = await Promise.all([
        api.get<AutomationJobSetting[]>(`/api/v1/projects/${projectId}/automation/settings`),
        api.get<AutomationRunLog[]>(`/api/v1/projects/${projectId}/automation/runs?limit=15`),
      ])
      setSettings(settingsData || [])
      setRuns(runsData || [])
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load automation settings',
      })
    } finally {
      setLoadingSettings(false)
    }
  }

  const handleToggleJob = async (jobType: AutomationJobType, currentEnabled: boolean) => {
    if (!selectedProjectId) return
    try {
      await api.patch(`/api/v1/projects/${selectedProjectId}/automation/settings/${jobType}`, {
        enabled: !currentEnabled,
      })
      setSettings((prev) =>
        prev.map((s) => (s.job_type === jobType ? { ...s, enabled: !currentEnabled } : s))
      )
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to update job status.' })
    }
  }

  const handleChangeFrequency = async (jobType: AutomationJobType, frequency: AutomationFrequency) => {
    if (!selectedProjectId) return
    try {
      await api.patch(`/api/v1/projects/${selectedProjectId}/automation/settings/${jobType}`, {
        frequency,
      })
      setSettings((prev) =>
        prev.map((s) => (s.job_type === jobType ? { ...s, frequency } : s))
      )
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to update job frequency.' })
    }
  }

  const handleRunNow = async (jobType: AutomationJobType) => {
    if (!selectedProjectId || triggeringJob) return
    setTriggeringJob(jobType)
    setStatusMessage(null)
    try {
      const res = await api.post<{ message?: string; status?: string }>(
        `/api/v1/projects/${selectedProjectId}/automation/run/${jobType}`,
        {
          parameters: { force: true },
        }
      )
      setStatusMessage({
        type: 'success',
        text: res.message || `Job '${JOB_METADATA[jobType]?.title || jobType}' completed. Status: ${res.status}`,
      })
      await loadAutomationData(selectedProjectId)
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to run job ${jobType}.`,
      })
    } finally {
      setTriggeringJob(null)
    }
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Automation & Autonomous Pipelines
            </h1>
            <Badge variant="seo">Production Engine</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Configure automated schedules, data sync frequencies, and trigger background jobs with failure isolation.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value)
              setSearchParams({ project: e.target.value })
            }}
            className="text-xs font-semibold bg-transparent text-slate-900 cursor-pointer focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between animate-scale-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* ── Scheduled Jobs Grid ─────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={13} className="text-blue-600" />
          Autonomous Background Jobs ({settings.length})
        </h2>

        {loadingSettings ? (
          <Card className="p-8 text-center text-xs text-slate-400">
            <RotateCw size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
            Loading job settings...
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.map((job) => {
              const meta = JOB_METADATA[job.job_type] || {
                title: job.job_type,
                description: 'Automated job pipeline',
                icon: Layers,
              }
              const Icon = meta.icon
              const isRunning = triggeringJob === job.job_type

              return (
                <Card
                  key={job.job_type}
                  hoverLift
                  className={`p-5 transition-all border ${
                    job.enabled
                      ? 'bg-white border-slate-200/90 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200/60 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0 border border-blue-100">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          {meta.title}
                        </h3>
                        <Badge
                          variant={job.enabled ? 'success' : 'neutral'}
                          className="text-[9px] mt-0.5"
                          dot
                        >
                          {job.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggleJob(job.job_type, job.enabled)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        job.enabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                      role="switch"
                      aria-checked={job.enabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          job.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4 min-h-[34px]">
                    {meta.description}
                  </p>

                  {/* Settings row */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Cadence:</span>
                      <select
                        value={job.frequency}
                        onChange={(e) =>
                          handleChangeFrequency(job.job_type, e.target.value as AutomationFrequency)
                        }
                        disabled={!job.enabled}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:outline-none"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {/* Run Now Button */}
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => handleRunNow(job.job_type)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5"
                    >
                      {isRunning ? (
                        <>
                          <RotateCw size={11} className="animate-spin text-blue-600" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play size={11} />
                          Run Now
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Timestamps */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      Last: {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      Next: {job.next_run_at ? new Date(job.next_run_at).toLocaleDateString() : 'Scheduled'}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Execution History Run Log ────────────────────────── */}
      <div className="space-y-3 pt-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Activity size={13} className="text-blue-600" />
          Execution Run History ({runs.length})
        </h2>

        {runs.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-400 border-dashed border-slate-300">
            No execution logs recorded yet. Automated or manual runs will be listed here.
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-4">Job Type</th>
                    <th className="py-2.5 px-4">Trigger</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Executed At</th>
                    <th className="py-2.5 px-4">Summary / Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {JOB_METADATA[r.job_type]?.title || r.job_type}
                      </td>
                      <td className="py-3 px-4 text-slate-600 capitalize">
                        {r.is_manual ? 'Manual' : 'Scheduled'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1.5">
                          {r.status === 'completed' && <CheckCircle2 size={13} className="text-emerald-600" />}
                          {r.status === 'partial_success' && <AlertTriangle size={13} className="text-amber-600" />}
                          {r.status === 'failed' && <XCircle size={13} className="text-rose-600" />}
                          {r.status === 'skipped' && <Clock size={13} className="text-slate-400" />}
                          <Badge
                            variant={
                              r.status === 'completed'
                                ? 'success'
                                : r.status === 'partial_success'
                                ? 'warning'
                                : r.status === 'failed'
                                ? 'danger'
                                : 'neutral'
                            }
                            className="text-[10px] capitalize"
                          >
                            {r.status.replace(/_/g, ' ')}
                          </Badge>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {r.duration_seconds !== null && r.duration_seconds !== undefined
                          ? `${r.duration_seconds.toFixed(1)}s`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(r.started_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {r.error_message || (r.result_summary?.message as string) || 'Executed successfully.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
