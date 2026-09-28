import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Settings,
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
    title: 'LangGraph Intelligence Reasoning',
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
        const qpId = searchParams.get('projectId')
        if (qpId && items.some((p) => p.id === qpId)) {
          setSelectedProjectId(qpId)
        } else if (items.length > 0) {
          setSelectedProjectId(items[0].id)
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err?.message || 'Failed to load projects' })
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, [])

  // 2. Load automation settings & recent runs
  useEffect(() => {
    if (!selectedProjectId) return
    loadAutomationData(selectedProjectId)
  }, [selectedProjectId])

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
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to load automation settings' })
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
    } catch (err: any) {
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
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to update job frequency.' })
    }
  }

  const handleRunNow = async (jobType: AutomationJobType) => {
    if (!selectedProjectId || triggeringJob) return
    setTriggeringJob(jobType)
    setStatusMessage(null)
    try {
      const res = await api.post<any>(`/api/v1/projects/${selectedProjectId}/automation/run/${jobType}`, {
        parameters: { force: true },
      })
      setStatusMessage({
        type: 'success',
        text: res.message || `Job '${JOB_METADATA[jobType]?.title || jobType}' completed. Status: ${res.status}`,
      })
      await loadAutomationData(selectedProjectId)
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || `Failed to run job ${jobType}.`,
      })
    } finally {
      setTriggeringJob(null)
    }
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Settings className="text-[var(--color-primary-600)]" size={24} />
            Automation & Production Intelligence
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Configure automated schedules, data sync frequencies, and trigger jobs manually with failure isolation.
          </p>
        </div>

        {/* Project Selector */}
        <select
          value={selectedProjectId}
          onChange={(e) => {
            setSelectedProjectId(e.target.value)
            setSearchParams({ projectId: e.target.value })
          }}
          className="text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success)]/20'
              : 'bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger)]/20'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* ── Scheduled Jobs Grid ─────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Scheduled Autonomous Jobs ({settings.length})
        </h2>

        {loadingSettings ? (
          <Card className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
            <RotateCw size={18} className="animate-spin mx-auto mb-2 text-[var(--color-primary-600)]" />
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
                  className={`p-5 transition-all border ${
                    job.enabled
                      ? 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-xs'
                      : 'bg-[var(--color-surface-secondary)] border-[var(--color-border)] opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-surface-tertiary)] shrink-0">
                        <Icon size={18} className="text-[var(--color-primary-600)]" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                          {meta.title}
                        </h3>
                        <Badge variant={job.enabled ? 'success' : 'neutral'} className="text-[9px] mt-0.5">
                          {job.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggleJob(job.job_type, job.enabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        job.enabled ? 'bg-[var(--color-primary-600)]' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={job.enabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          job.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4 min-h-[32px]">
                    {meta.description}
                  </p>

                  {/* Settings row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">Frequency:</span>
                      <select
                        value={job.frequency}
                        onChange={(e) =>
                          handleChangeFrequency(job.job_type, e.target.value as AutomationFrequency)
                        }
                        disabled={!job.enabled}
                        className="text-xs bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-primary)] font-medium"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {/* Run Now Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunNow(job.job_type)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5"
                    >
                      {isRunning ? (
                        <>
                          <RotateCw size={12} className="animate-spin text-[var(--color-primary-600)]" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          Run Now
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Timestamps */}
                  <div className="flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)] mt-3 pt-2 border-t border-[var(--color-border)]">
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
        <h2 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Recent Automation Execution Runs ({runs.length})
        </h2>

        {runs.length === 0 ? (
          <Card className="p-6 text-center text-xs text-[var(--color-text-tertiary)]">
            No execution logs recorded yet. Automated or manual runs will be listed here.
          </Card>
        ) : (
          <Card className="overflow-hidden border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] text-[10px] uppercase tracking-wider border-b border-[var(--color-border)]">
                    <th className="py-2.5 px-4 font-semibold">Job Type</th>
                    <th className="py-2.5 px-4 font-semibold">Trigger</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Duration</th>
                    <th className="py-2.5 px-4 font-semibold">Executed At</th>
                    <th className="py-2.5 px-4 font-semibold">Summary / Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--color-surface-tertiary)]">
                      <td className="py-3 px-4 font-medium text-[var(--color-text-primary)]">
                        {JOB_METADATA[r.job_type]?.title || r.job_type}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] capitalize">
                        {r.is_manual ? 'Manual' : 'Scheduled'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1.5">
                          {r.status === 'completed' && <CheckCircle2 size={13} className="text-[var(--color-success)]" />}
                          {r.status === 'partial_success' && <AlertTriangle size={13} className="text-[var(--color-warning)]" />}
                          {r.status === 'failed' && <XCircle size={13} className="text-[var(--color-danger)]" />}
                          {r.status === 'skipped' && <Clock size={13} className="text-[var(--color-text-tertiary)]" />}
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
                            className="text-[9px] capitalize"
                          >
                            {r.status.replace('_', ' ')}
                          </Badge>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {r.duration_seconds !== null && r.duration_seconds !== undefined
                          ? `${r.duration_seconds.toFixed(1)}s`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-tertiary)]">
                        {new Date(r.started_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)] max-w-xs truncate">
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
