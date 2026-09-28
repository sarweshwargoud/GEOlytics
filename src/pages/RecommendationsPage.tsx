import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Lightbulb,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Brain,
  FlaskConical,
  X,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  Recommendation,
  AgentRunResponse,
} from '@/types'

export default function RecommendationsPage() {
  const api = useApi()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Recommendations State
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [runningAgent, setRunningAgent] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Detail & Rejection Modals
  const [selectedRecForDetail, setSelectedRecForDetail] = useState<Recommendation | null>(null)
  const [rejectingRec, setRejectingRec] = useState<Recommendation | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

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

  // 2. Fetch recommendations for selected project
  const fetchRecommendations = async (projectId: string) => {
    if (!projectId) return
    setLoadingRecs(true)
    setErrorMessage('')
    try {
      let url = `/api/v1/projects/${projectId}/recommendations`
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      const qs = params.toString()
      if (qs) url += `?${qs}`

      const data = await api.get<Recommendation[]>(url)
      setRecommendations(data || [])
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load recommendations')
    } finally {
      setLoadingRecs(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      fetchRecommendations(selectedProjectId)
    }
  }, [selectedProjectId, statusFilter, priorityFilter, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id)
    setSearchParams({ project: id })
  }

  // 3. Trigger LangGraph Agent Run
  const handleRunAgent = async () => {
    if (!selectedProjectId) return
    setRunningAgent(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const res = await api.post<AgentRunResponse>(
        `/api/v1/projects/${selectedProjectId}/agent/run`,
        {}
      )
      setSuccessMessage(res.summary)
      await fetchRecommendations(selectedProjectId)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Agent pipeline failed')
    } finally {
      setRunningAgent(false)
    }
  }

  // 4. Approve recommendation
  const handleApprove = async (recId: string) => {
    setSubmittingAction(true)
    setErrorMessage('')
    try {
      const updated = await api.post<Recommendation>(`/api/v1/recommendations/${recId}/approve`, {})
      setRecommendations((prev) => prev.map((r) => (r.id === recId ? updated : r)))
      if (selectedRecForDetail?.id === recId) {
        setSelectedRecForDetail(updated)
      }
      setSuccessMessage(`Recommendation approved. Strategic memory saved to Hindsight.`)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setSubmittingAction(false)
    }
  }

  // 5. Reject recommendation
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingRec || !rejectionReason.trim()) return
    setSubmittingAction(true)
    setErrorMessage('')
    try {
      const updated = await api.post<Recommendation>(
        `/api/v1/recommendations/${rejectingRec.id}/reject`,
        { reason: rejectionReason.trim() }
      )
      setRecommendations((prev) => prev.map((r) => (r.id === rejectingRec.id ? updated : r)))
      if (selectedRecForDetail?.id === rejectingRec.id) {
        setSelectedRecForDetail(updated)
      }
      setRejectingRec(null)
      setRejectionReason('')
      setSuccessMessage(`Recommendation rejected. Preference constraint saved to Hindsight.`)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setSubmittingAction(false)
    }
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Lightbulb size={18} />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              Recommendation Intelligence
            </h1>
            <Badge variant="seo">LangGraph + Hindsight</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Evidence-based recommendations reasoned over SEO audits, Search Console, GEO citations, and persistent Hindsight memory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)] shadow-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.website_url})
                </option>
              ))}
            </select>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunAgent}
            disabled={runningAgent}
          >
            {runningAgent ? (
              <>
                <RotateCw size={13} className="animate-spin" />
                Reasoning (LangGraph)...
              </>
            ) : (
              <>
                <Play size={13} /> Run Intelligence Agent
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Mandatory Human Approval Notice ───────────────────── */}
      <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-center gap-2.5">
        <ShieldCheck size={18} className="text-blue-600 shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-semibold">Human Approval Mandatory:</strong> The agent synthesizes observations, hypotheses, and experiments, but never modifies your website automatically. All recommendations require your explicit review and approval.
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-red-500 hover:text-red-700 font-bold"
          >
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
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-500 hover:text-emerald-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Filters Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--color-text-tertiary)] font-medium">Filter by:</span>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-[var(--color-text-secondary)] font-medium focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Priority */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-[var(--color-text-secondary)] font-medium focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Category */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-[var(--color-text-secondary)] font-medium focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="content">Content</option>
          <option value="metadata">Metadata / Snippet</option>
          <option value="schema">Schema Markup</option>
          <option value="technical">Technical SEO</option>
          <option value="geo_visibility">GEO Visibility</option>
        </select>

        <span className="ml-auto text-[11px] text-[var(--color-text-tertiary)]">
          Showing {recommendations.length} recommendation{recommendations.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── Recommendations List ──────────────────────────────── */}
      {loadingRecs ? (
        <LoadingState message="Loading recommendations..." />
      ) : recommendations.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={22} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            No Recommendations Generated Yet
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mb-4">
            Click "Run Intelligence Agent" to execute the 9-node LangGraph pipeline. It will synthesize audit findings, Search Console performance, GEO visibility, and Hindsight memory to generate evidence-backed proposals.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleRunAgent}
            disabled={runningAgent}
          >
            <Play size={13} /> Run Intelligence Agent Now
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const isPending = rec.status === 'pending'
            const isApproved = rec.status === 'approved'
            const isRejected = rec.status === 'rejected'

            return (
              <Card key={rec.id} className="p-5 transition-shadow hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority */}
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          rec.priority === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : rec.priority === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {rec.priority} Priority
                      </span>

                      {/* Type */}
                      <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {rec.type.replace('_', ' ')}
                      </span>

                      {/* Status */}
                      {isPending && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
                          ● Pending Review
                        </span>
                      )}
                      {isApproved && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          ✕ Rejected
                        </span>
                      )}

                      <span className="text-[11px] text-[var(--color-text-tertiary)] ml-auto font-mono">
                        Confidence: {Math.round(rec.confidence * 100)}%
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                      {rec.title}
                    </h3>
                  </div>
                </div>

                {/* Body Content */}
                <div className="mt-3.5 space-y-3 text-xs">
                  {/* Action */}
                  <div className="p-3 bg-[var(--color-surface-secondary)] rounded-lg border border-[var(--color-border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--color-text-secondary)] block mb-1">
                      Action to Test:
                    </span>
                    <p className="text-[var(--color-text-primary)] font-medium leading-relaxed">
                      {rec.action}
                    </p>
                  </div>

                  {/* Why (Reason) & Hypothesis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-[var(--color-border)]">
                      <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                        Why (Evidence-Based Reason):
                      </span>
                      <p className="text-gray-700 leading-relaxed">{rec.reason}</p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-[var(--color-border)]">
                      <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                        Hypothesis:
                      </span>
                      <p className="text-gray-700 leading-relaxed">{rec.hypothesis}</p>
                    </div>
                  </div>

                  {/* Supporting Evidence */}
                  {rec.evidence && rec.evidence.length > 0 && (
                    <div className="bg-gray-50/70 p-2.5 rounded border border-gray-200">
                      <span className="text-[11px] font-bold text-gray-600 block mb-1">
                        Supporting Evidence:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600">
                        {rec.evidence.map((ev, idx) => (
                          <li key={idx}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Historical Learning (Hindsight) */}
                  {rec.historical_memory && rec.historical_memory.length > 0 && (
                    <div className="bg-purple-50/60 border border-purple-100 p-2.5 rounded text-purple-900 text-[11px] flex items-start gap-2">
                      <Brain size={14} className="text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold">Hindsight Historical Learning:</strong>{' '}
                        <span>{rec.historical_memory[0]}</span>
                      </div>
                    </div>
                  )}

                  {/* Experiment & Measurement */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)] text-[11px] text-gray-500">
                    <div>
                      <span className="font-semibold text-gray-700">Measure via:</span>{' '}
                      {rec.measurement_criteria?.join(', ') || 'Organic clicks & position stability'}
                    </div>

                    {isRejected && rec.rejection_reason && (
                      <div className="text-red-600 font-medium">
                        Rejection reason: {rec.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRecForDetail(rec)}
                  >
                    View Full Intelligence Dossier
                  </Button>

                  {isPending && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectingRec(rec)
                          setRejectionReason('')
                        }}
                        disabled={submittingAction}
                      >
                        <XCircle size={13} className="text-red-500" />
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(rec.id)}
                        disabled={submittingAction}
                      >
                        <CheckCircle2 size={13} />
                        Approve Recommendation
                      </Button>
                    </div>
                  )}

                  {isApproved && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Approved
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/experiments?project=${selectedProjectId}&fromRec=${rec.id}`)}
                        className="flex items-center gap-1.5"
                      >
                        <FlaskConical size={13} /> Launch Experiment
                      </Button>
                    </div>
                  )}

                  {rec.status === 'experiment_created' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/experiments?project=${selectedProjectId}`)}
                      className="flex items-center gap-1.5"
                    >
                      <FlaskConical size={13} /> View Experiment
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Rejection Modal ────────────────────────────────────── */}
      {rejectingRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Reject Recommendation
              </h3>
              <button
                onClick={() => setRejectingRec(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Please explain why this proposal is unsuitable. GEOlytics will retain this in Hindsight memory so future recommendations avoid similar patterns.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Does not align with current brand tone, or already addressed in an upcoming release..."
                  rows={3}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectingRec(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={submittingAction || !rejectionReason.trim()}
                >
                  {submittingAction ? 'Recording...' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Detail Modal ───────────────────────────────────────── */}
      {selectedRecForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-surface-secondary)]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {selectedRecForDetail.type} • {selectedRecForDetail.priority} priority
                </span>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  {selectedRecForDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecForDetail(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                  Action to Take:
                </span>
                <div className="p-3 bg-[var(--color-surface-secondary)] rounded-lg font-medium text-gray-800">
                  {selectedRecForDetail.action}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                  Reason & Underlying Cause:
                </span>
                <p className="text-gray-700 leading-relaxed">{selectedRecForDetail.reason}</p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                  Hypothesis:
                </span>
                <p className="text-gray-700 leading-relaxed">{selectedRecForDetail.hypothesis}</p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                  Suggested Experiment Protocol:
                </span>
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-blue-900 leading-relaxed">
                  {selectedRecForDetail.suggested_experiment}
                </div>
              </div>

              {selectedRecForDetail.evidence && (
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                    Verifiable Evidence Points:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {selectedRecForDetail.evidence.map((ev, idx) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRecForDetail.affected_pages && selectedRecForDetail.affected_pages.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                    Affected Pages:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedRecForDetail.affected_pages.map((p, idx) => (
                      <span key={idx} className="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-border)] px-5 py-3 bg-[var(--color-surface-secondary)] flex justify-between items-center text-[11px] text-gray-500">
              <span>Status: <strong className="uppercase">{selectedRecForDetail.status}</strong></span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecForDetail(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
