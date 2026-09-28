import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Minus,
  Brain,
  ShieldAlert,
  Plus,
  RefreshCw,
  X,
  Calendar,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  Experiment,
  Recommendation,
} from '@/types'

export default function ExperimentsPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Experiments state
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loadingExperiments, setLoadingExperiments] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Detail Modal & Action State
  const [selectedExpForDetail, setSelectedExpForDetail] = useState<Experiment | null>(null)
  const [measuringId, setMeasuringId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)

  // Implementation Confirm Modal
  const [confirmingExp, setConfirmingExp] = useState<Experiment | null>(null)
  const [implNotes, setImplNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [approvedRecs, setApprovedRecs] = useState<Recommendation[]>([])
  const [newExpName, setNewExpName] = useState('')
  const [newExpHypothesis, setNewExpHypothesis] = useState('')
  const [newExpWindow, setNewExpWindow] = useState(14)
  const [newExpRecId, setNewExpRecId] = useState('')
  const [creatingExp, setCreatingExp] = useState(false)

  // 1. Fetch user projects
  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true)
      try {
        const res = await api.get<ProjectListResponse>('/api/v1/projects')
        setProjects(res.projects)
        const paramId = searchParams.get('project')
        if (paramId && res.projects.some((p) => p.id === paramId)) {
          setSelectedProjectId(paramId)
        } else if (res.projects.length > 0) {
          setSelectedProjectId(res.projects[0].id)
          setSearchParams({ project: res.projects[0].id })
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Fetch experiments for selected project
  const fetchExperiments = async (projectId: string) => {
    if (!projectId) return
    setLoadingExperiments(true)
    setErrorMessage('')
    try {
      let url = `/api/v1/projects/${projectId}/experiments`
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`
      }
      const data = await api.get<Experiment[]>(url)
      setExperiments(data || [])

      // Also refresh the selected detail modal if open
      if (selectedExpForDetail) {
        const updated = (data || []).find((e) => e.id === selectedExpForDetail.id)
        if (updated) setSelectedExpForDetail(updated)
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load experiments')
    } finally {
      setLoadingExperiments(false)
    }
  }

  // 3. Load approved recommendations for creation modal
  const loadApprovedRecs = async (projectId: string) => {
    if (!projectId) return
    try {
      const data = await api.get<Recommendation[]>(`/api/v1/projects/${projectId}/recommendations?status=approved`)
      setApprovedRecs(data || [])
    } catch {
      setApprovedRecs([])
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      fetchExperiments(selectedProjectId)
      loadApprovedRecs(selectedProjectId)
    }
  }, [selectedProjectId, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL pre-fill from recommendations page (?createFromRec=...)
  useEffect(() => {
    const fromRecId = searchParams.get('fromRec')
    if (fromRecId && approvedRecs.length > 0) {
      const rec = approvedRecs.find((r) => r.id === fromRecId)
      if (rec) {
        setNewExpRecId(rec.id)
        setNewExpName(rec.title)
        setNewExpHypothesis(rec.hypothesis)
        setCreateModalOpen(true)
      }
    }
  }, [searchParams, approvedRecs])

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id)
    setSearchParams({ project: id })
  }

  // 4. Create new experiment
  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId || !newExpName || !newExpHypothesis) return
    setCreatingExp(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const payload = {
        name: newExpName,
        hypothesis: newExpHypothesis,
        measurement_window_days: newExpWindow,
        recommendation_id: newExpRecId || undefined,
      }
      const created = await api.post<Experiment>(
        `/api/v1/projects/${selectedProjectId}/experiments`,
        payload
      )
      setSuccessMessage(`Experiment "${created.name}" created with baseline captured!`)
      setCreateModalOpen(false)
      setNewExpName('')
      setNewExpHypothesis('')
      setNewExpRecId('')
      fetchExperiments(selectedProjectId)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create experiment')
    } finally {
      setCreatingExp(false)
    }
  }

  // 5. Confirm human implementation
  const handleConfirmImplementation = async () => {
    if (!confirmingExp) return
    setSubmittingAction(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await api.post(`/api/v1/experiments/${confirmingExp.id}/confirm-implementation`, {
        implementation_notes: implNotes || undefined,
      })
      setSuccessMessage(`Implementation confirmed for "${confirmingExp.name}". Measurement window started.`)
      setConfirmingExp(null)
      setImplNotes('')
      fetchExperiments(selectedProjectId)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to confirm implementation')
    } finally {
      setSubmittingAction(false)
    }
  }

  // 6. Measure experiment
  const handleMeasureExperiment = async (expId: string) => {
    setMeasuringId(expId)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const updated = await api.post<Experiment>(`/api/v1/experiments/${expId}/measure`, {})
      setSuccessMessage('Measurement and before-vs-after delta analysis updated.')
      if (selectedExpForDetail && selectedExpForDetail.id === expId) {
        setSelectedExpForDetail(updated)
      }
      fetchExperiments(selectedProjectId)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Measurement failed')
    } finally {
      setMeasuringId(null)
    }
  }

  // 7. Complete experiment & store in Hindsight
  const handleCompleteExperiment = async (expId: string) => {
    setCompletingId(expId)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const completed = await api.post<Experiment>(`/api/v1/experiments/${expId}/complete`, {})
      setSuccessMessage(`Experiment completed with outcome: ${completed.outcome.toUpperCase()}. Outcome retained in Hindsight memory.`)
      if (selectedExpForDetail && selectedExpForDetail.id === expId) {
        setSelectedExpForDetail(completed)
      }
      fetchExperiments(selectedProjectId)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to complete experiment')
    } finally {
      setCompletingId(null)
    }
  }

  // Progress calculator
  const calculateProgress = (exp: Experiment): number => {
    if (exp.status === 'completed') return 100
    if (!exp.measurement_start || !exp.measurement_end) return 0
    const start = new Date(exp.measurement_start).getTime()
    const end = new Date(exp.measurement_end).getTime()
    const now = Date.now()
    if (now <= start) return 0
    if (now >= end) return 100
    return Math.min(100, Math.round(((now - start) / (end - start)) * 100))
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              SEO & GEO Experiments
            </h1>
            <Badge variant="info">Closed-Loop Learning</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Test approved recommendations, capture pre-change baselines, measure before-vs-after deltas, and store verified lessons in Hindsight.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {projects.length > 1 && (
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] font-medium focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus size={14} /> New Experiment
          </Button>
        </div>
      </div>

      {/* ── Causality Notice ───────────────────────────────────── */}
      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-950 flex items-start gap-2.5">
        <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold">Evidence-Driven Attribution:</strong> GEOlytics never claims an SEO/GEO edit directly caused an outcome unless verified data supports that conclusion. Metrics reflect observed associations within the measurement window, with explicit confounding factors noted.
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-tertiary)] font-medium">Filter Status:</span>
          {['all', 'measuring', 'running', 'baseline_captured', 'completed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-[var(--color-primary-600)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
              }`}
            >
              {st === 'all' ? 'All' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchExperiments(selectedProjectId)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1"
        >
          <RefreshCw size={12} className={loadingExperiments ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Experiment Cards Grid ──────────────────────────────── */}
      {loadingExperiments ? (
        <LoadingState message="Loading experiments..." />
      ) : experiments.length === 0 ? (
        <Card className="text-center py-14">
          <FlaskConical size={36} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            No Experiments Active
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mt-1 mb-4">
            Turn approved SEO or GEO recommendations into measurable experiments with automated pre/post comparisons.
          </p>
          <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus size={14} className="mr-1.5" /> Create Your First Experiment
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {experiments.map((exp) => {
            const progress = calculateProgress(exp)
            const baseline = exp.baseline_period || {}
            const bSeo = baseline.seo || {}
            const bGeo = baseline.geo || {}
            const result = exp.result || {}
            const deltas = result.deltas || {}
            const seoDeltas = deltas.seo || {}
            const geoDeltas = deltas.geo || {}

            const statusColors: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'danger'> = {
              draft: 'neutral',
              approved: 'info',
              baseline_captured: 'info',
              implementation_pending: 'warning',
              running: 'info',
              measuring: 'info',
              completed: 'success',
              cancelled: 'neutral',
            }

            const outcomeColors: Record<string, string> = {
              positive: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              neutral: 'bg-gray-100 text-gray-800 border-gray-300',
              negative: 'bg-red-100 text-red-800 border-red-300',
              inconclusive: 'bg-amber-100 text-amber-800 border-amber-300',
              insufficient_data: 'bg-purple-100 text-purple-800 border-purple-300',
              pending: 'bg-blue-50 text-blue-700 border-blue-200',
            }

            return (
              <Card key={exp.id} className="p-5 flex flex-col justify-between hover:border-[var(--color-primary-300)] transition-all">
                <div>
                  {/* Top Bar: Status + Outcome */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColors[exp.status] || 'neutral'}>
                        {exp.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {exp.outcome !== 'pending' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${outcomeColors[exp.outcome] || ''}`}>
                          Outcome: {exp.outcome.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1 font-mono">
                      <Calendar size={12} />
                      {new Date(exp.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & Hypothesis */}
                  <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1.5 leading-snug">
                    {exp.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] italic mb-4 leading-relaxed bg-[var(--color-surface-secondary)] p-2.5 rounded border border-[var(--color-border)]">
                    <strong className="not-italic font-semibold text-gray-700">Hypothesis:</strong> {exp.hypothesis}
                  </p>

                  {/* Progress Bar (Measurement Window) */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-gray-600 flex items-center gap-1">
                        <Clock size={12} /> Measurement Window ({baseline.days || 14} days)
                      </span>
                      <span className="font-bold text-[var(--color-primary-600)]">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className="h-full bg-[var(--color-primary-600)] rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Snapshot Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs mb-4">
                    {/* Clicks */}
                    <div className="p-2 rounded bg-gray-50 border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Clicks</span>
                      <span className="font-bold text-gray-800 text-sm">
                        {seoDeltas.clicks?.after !== undefined ? seoDeltas.clicks.after : bSeo.clicks || '—'}
                      </span>
                      {seoDeltas.clicks && (
                        <span className={`text-[10px] block font-semibold ${seoDeltas.clicks.absolute_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {seoDeltas.clicks.absolute_delta >= 0 ? '+' : ''}{seoDeltas.clicks.absolute_delta}
                        </span>
                      )}
                    </div>

                    {/* Impressions */}
                    <div className="p-2 rounded bg-gray-50 border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Impressions</span>
                      <span className="font-bold text-gray-800 text-sm">
                        {seoDeltas.impressions?.after !== undefined ? seoDeltas.impressions.after : bSeo.impressions || '—'}
                      </span>
                      {seoDeltas.impressions && (
                        <span className={`text-[10px] block font-semibold ${seoDeltas.impressions.absolute_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {seoDeltas.impressions.absolute_delta >= 0 ? '+' : ''}{seoDeltas.impressions.absolute_delta}
                        </span>
                      )}
                    </div>

                    {/* CTR */}
                    <div className="p-2 rounded bg-gray-50 border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">CTR</span>
                      <span className="font-bold text-gray-800 text-sm">
                        {seoDeltas.ctr?.after !== undefined ? `${seoDeltas.ctr.after}%` : bSeo.ctr ? `${bSeo.ctr}%` : '—'}
                      </span>
                      {seoDeltas.ctr && (
                        <span className={`text-[10px] block font-semibold ${seoDeltas.ctr.pp_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {seoDeltas.ctr.pp_delta >= 0 ? '+' : ''}{seoDeltas.ctr.pp_delta}pp
                        </span>
                      )}
                    </div>

                    {/* AI Citations */}
                    <div className="p-2 rounded bg-gray-50 border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">AI Citations</span>
                      <span className="font-bold text-gray-800 text-sm">
                        {geoDeltas.citations?.after !== undefined ? geoDeltas.citations.after : bGeo.observed_citations ?? '—'}
                      </span>
                      {geoDeltas.citations && (
                        <span className={`text-[10px] block font-semibold ${geoDeltas.citations.absolute_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {geoDeltas.citations.absolute_delta >= 0 ? '+' : ''}{geoDeltas.citations.absolute_delta}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedExpForDetail(exp)}
                  >
                    View Before vs After Dossier
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {exp.status === 'baseline_captured' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfirmingExp(exp)
                          setImplNotes('')
                        }}
                      >
                        Confirm Implemented
                      </Button>
                    )}

                    {['measuring', 'running'].includes(exp.status) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={measuringId === exp.id}
                          onClick={() => handleMeasureExperiment(exp.id)}
                        >
                          <RefreshCw size={12} className={measuringId === exp.id ? 'animate-spin' : ''} />
                          Measure
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={completingId === exp.id}
                          onClick={() => handleCompleteExperiment(exp.id)}
                        >
                          Complete & Learn
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── New Experiment Modal ──────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FlaskConical size={20} className="text-[var(--color-primary-600)]" />
                <h2 className="text-base font-bold text-gray-900">Create New Experiment</h2>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExperiment} className="space-y-4 text-xs">
              {/* Optional Link to Approved Recommendation */}
              {approvedRecs.length > 0 && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Link to Approved Recommendation (Optional)
                  </label>
                  <select
                    value={newExpRecId}
                    onChange={(e) => {
                      const recId = e.target.value
                      setNewExpRecId(recId)
                      const found = approvedRecs.find((r) => r.id === recId)
                      if (found) {
                        setNewExpName(found.title)
                        setNewExpHypothesis(found.hypothesis)
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg p-2 bg-gray-50 focus:bg-white"
                  >
                    <option value="">-- Standalone Experiment (Not linked) --</option>
                    {approvedRecs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Experiment Name */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Experiment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Add Comparison Table to Pricing Page"
                  value={newExpName}
                  onChange={(e) => setNewExpName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-[var(--color-primary-500)]"
                />
              </div>

              {/* Hypothesis */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Hypothesis <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Adding structured comparison content will improve organic CTR by at least 5% and increase observable Gemini citations."
                  value={newExpHypothesis}
                  onChange={(e) => setNewExpHypothesis(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-[var(--color-primary-500)] leading-relaxed"
                />
              </div>

              {/* Measurement Window Days */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Measurement Window Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 28].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setNewExpWindow(days)}
                      className={`p-2.5 rounded-lg border text-center font-semibold transition-all ${
                        newExpWindow === days
                          ? 'bg-[var(--color-primary-50)] border-[var(--color-primary-600)] text-[var(--color-primary-700)]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
                <strong>Automatic Baseline Capture:</strong> Pre-change Search Console metrics and GEO AI search checks will be automatically pulled for the past {newExpWindow} days upon creation.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={creatingExp}>
                  {creatingExp ? 'Capturing Baseline...' : 'Create Experiment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Implementation Confirm Modal ──────────────────────── */}
      {confirmingExp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h2 className="text-base font-bold text-gray-900">Confirm Website Implementation</h2>
              </div>
              <button onClick={() => setConfirmingExp(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Confirm that you have deployed the change for <strong>"{confirmingExp.name}"</strong> onto your website. This will start the measurement window timer.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Implementation Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Published new comparison table and updated H1 on /pricing page."
                value={implNotes}
                onChange={(e) => setImplNotes(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingExp(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submittingAction}
                onClick={handleConfirmImplementation}
              >
                {submittingAction ? 'Starting...' : 'Confirm & Start Measuring'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detailed Experiment Dossier Modal ─────────────────── */}
      {selectedExpForDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="info">{selectedExpForDetail.status.toUpperCase()}</Badge>
                  {selectedExpForDetail.outcome !== 'pending' && (
                    <Badge variant={selectedExpForDetail.outcome === 'positive' ? 'success' : selectedExpForDetail.outcome === 'negative' ? 'danger' : 'neutral'}>
                      OUTCOME: {selectedExpForDetail.outcome.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {selectedExpForDetail.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedExpForDetail(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-gray-700">
              {/* Section 1: Hypothesis & Implementation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-1">
                  <span className="font-bold text-blue-900 uppercase text-[10px] tracking-wide block">
                    Expected Hypothesis
                  </span>
                  <p className="text-blue-950 leading-relaxed font-medium">
                    {selectedExpForDetail.hypothesis}
                  </p>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                  <span className="font-bold text-gray-700 uppercase text-[10px] tracking-wide block">
                    Measurement Period
                  </span>
                  <div className="space-y-0.5 text-gray-600">
                    <p>
                      <strong>Baseline Window:</strong> {selectedExpForDetail.baseline_period?.start_date || 'N/A'} to {selectedExpForDetail.baseline_period?.end_date || 'N/A'} ({selectedExpForDetail.baseline_period?.days || 14} days)
                    </p>
                    <p>
                      <strong>Implementation Date:</strong>{' '}
                      {selectedExpForDetail.implementation_date
                        ? new Date(selectedExpForDetail.implementation_date).toLocaleDateString()
                        : 'Pending confirmation'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Before vs After Metrics Table */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-blue-600" /> Before vs After Performance Deltas
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100/80 text-[11px] font-bold text-gray-700 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Metric</th>
                        <th className="py-2.5 px-3">Baseline</th>
                        <th className="py-2.5 px-3">Post-Implementation</th>
                        <th className="py-2.5 px-3">Delta / Change</th>
                        <th className="py-2.5 px-3">Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs">
                      {selectedExpForDetail.result?.metric_items && selectedExpForDetail.result.metric_items.length > 0 ? (
                        selectedExpForDetail.result.metric_items.map((m, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 font-semibold uppercase text-gray-800">
                              {m.metric.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-gray-600">
                              {m.baseline}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-gray-900 font-bold">
                              {m.after}
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              {m.formatted_display}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={
                                  m.status === 'improved'
                                    ? 'success'
                                    : m.status === 'regressed'
                                    ? 'danger'
                                    : 'neutral'
                                }
                              >
                                {m.status.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-gray-500 italic">
                            Run measurement to calculate before-vs-after delta metrics.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Success Criteria Evaluations */}
              {selectedExpForDetail.result?.criteria_evaluations && selectedExpForDetail.result.criteria_evaluations.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" /> Success Criteria Verification
                  </h3>
                  <div className="space-y-1.5">
                    {selectedExpForDetail.result.criteria_evaluations.map((c, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                          c.passed
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : 'bg-red-50/70 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {c.passed ? (
                            <CheckCircle2 size={15} className="text-emerald-600" />
                          ) : (
                            <Minus size={15} className="text-red-500" />
                          )}
                          <span className="font-medium">{c.criterion}</span>
                        </div>
                        <span className="text-[11px] font-mono">{c.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Causality & Confounding Factors Warning */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-lg space-y-2">
                <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wide flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-amber-700" /> Causality Guardrail & Limitations
                </span>
                <p className="text-amber-950 leading-relaxed text-[11px]">
                  Observed changes represent correlation within the measurement timeframe. The following external variables may have influenced these metrics:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900">
                  {(selectedExpForDetail.result?.limitations || []).map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>

              {/* Section 5: Hindsight Retained Closed-Loop Memory */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-1.5">
                <span className="font-bold text-purple-900 uppercase text-[10px] tracking-wide flex items-center gap-1.5">
                  <Brain size={14} className="text-purple-700" /> Hindsight Long-Term Memory Retained
                </span>
                <p className="text-purple-950 leading-relaxed text-[11px]">
                  {selectedExpForDetail.status === 'completed' ? (
                    <>
                      <strong>Closed-Loop Memory Stored:</strong> This experiment's outcome ({selectedExpForDetail.outcome.toUpperCase()}) has been retained in Hindsight memory. Future LangGraph recommendation runs will recall this outcome to calibrate future SEO and GEO strategies.
                    </>
                  ) : (
                    'Upon completion, this experiment outcome and its verified before/after evidence will be stored in Hindsight memory to instruct future agent recommendations.'
                  )}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelectedExpForDetail(null)}>
                Close
              </Button>

              <div className="flex items-center gap-2">
                {['measuring', 'running'].includes(selectedExpForDetail.status) && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={measuringId === selectedExpForDetail.id}
                      onClick={() => handleMeasureExperiment(selectedExpForDetail.id)}
                    >
                      <RefreshCw size={12} className={measuringId === selectedExpForDetail.id ? 'animate-spin' : ''} />
                      Measure Now
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={completingId === selectedExpForDetail.id}
                      onClick={() => handleCompleteExperiment(selectedExpForDetail.id)}
                    >
                      Complete & Retain Learning
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
