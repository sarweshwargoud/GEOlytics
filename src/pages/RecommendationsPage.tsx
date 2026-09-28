import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
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

  // Expanded items in list
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null)

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
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Recommendation Intelligence
            </h1>
            <Badge variant="seo">LangGraph Reasoning</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Evidence-based recommendations reasoned over SEO audits, Search Console, GEO citations, and Hindsight memory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {projects.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Project:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
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
      <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
        <ShieldCheck size={18} className="text-blue-600 shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-semibold text-blue-950">Human Approval Mandatory: </strong>
          The agent synthesizes observations, hypotheses, and experiments, but never modifies your website automatically. All recommendations require your explicit review and approval.
        </div>
      </div>

      {runningAgent && (
        <Card className="p-4 bg-purple-50/60 border-purple-200/80 animate-pulse">
          <div className="flex items-center gap-3">
            <RotateCw size={18} className="animate-spin text-purple-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-purple-950">
                LangGraph Multi-Node Intelligence Agent Active
              </p>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Synthesizing crawl audits, Search Console, GEO citations & recalling Hindsight memory...
              </p>
            </div>
          </div>
        </Card>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between animate-scale-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center justify-between animate-scale-in">
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Pending</span>
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                {recommendations.filter((r) => r.status === 'pending').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 ${
                statusFilter === 'approved'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Approved</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                {recommendations.filter((r) => r.status === 'approved').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all ${
                statusFilter === 'rejected'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {/* Priority */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium shadow-xs focus:outline-none"
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
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium shadow-xs focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="content">Content</option>
          <option value="metadata">Metadata / Snippet</option>
          <option value="schema">Schema Markup</option>
          <option value="technical">Technical SEO</option>
          <option value="geo_visibility">GEO Visibility</option>
        </select>

        <span className="ml-auto text-[11px] text-slate-400">
          Showing <AnimatedNumber value={recommendations.length} /> proposal
          {recommendations.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── Recommendations List ──────────────────────────────── */}
      {loadingRecs ? (
        <LoadingState message="Loading recommendations..." type="skeleton" />
      ) : recommendations.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-slate-300">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            No Recommendations Generated Yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
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
        <div className="space-y-3.5">
          {recommendations.map((rec, index) => {
            const isPending = rec.status === 'pending'
            const isApproved = rec.status === 'approved'
            const isRejected = rec.status === 'rejected'
            const isExpanded = expandedRecId === rec.id

            return (
              <Card
                key={rec.id}
                hoverLift
                className={`p-5 transition-all ${
                  isPending ? 'border-l-4 border-l-amber-500' : isApproved ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-slate-300'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          rec.priority === 'critical'
                            ? 'danger'
                            : rec.priority === 'high'
                            ? 'warning'
                            : 'info'
                        }
                        className="text-[10px]"
                        dot
                      >
                        {rec.priority} Priority
                      </Badge>

                      <Badge variant="neutral" className="text-[10px]">
                        {rec.type.replace(/_/g, ' ')}
                      </Badge>

                      {isPending && (
                        <Badge variant="warning" className="text-[10px]">
                          Pending Review
                        </Badge>
                      )}
                      {isApproved && (
                        <Badge variant="success" className="text-[10px]">
                          Approved
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge variant="neutral" className="text-[10px]">
                          Rejected
                        </Badge>
                      )}

                      <span className="text-[11px] text-slate-400 ml-auto font-mono">
                        Confidence: {Math.round(rec.confidence * 100)}%
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {rec.title}
                    </h3>
                  </div>
                </div>

                {/* Body Content */}
                <div className="mt-3.5 space-y-3 text-xs">
                  {/* Action */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      Action to Test:
                    </span>
                    <p className="text-slate-900 font-semibold leading-relaxed">
                      {rec.action}
                    </p>
                  </div>

                  {/* Why & Hypothesis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Why (Evidence-Based Reason):
                      </span>
                      <p className="text-slate-600 leading-relaxed">{rec.reason}</p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Hypothesis:
                      </span>
                      <p className="text-slate-600 leading-relaxed">{rec.hypothesis}</p>
                    </div>
                  </div>

                  {/* Supporting Evidence */}
                  {rec.evidence && rec.evidence.length > 0 && isExpanded && (
                    <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 animate-slide-down">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Supporting Evidence:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                        {rec.evidence.map((ev, idx) => (
                          <li key={idx}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Historical Learning (Hindsight) */}
                  {rec.historical_memory && rec.historical_memory.length > 0 && (
                    <div className="bg-purple-50/70 border border-purple-200/80 p-3 rounded-lg text-purple-900 text-xs flex items-start gap-2.5">
                      <Brain size={15} className="text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold text-purple-950">
                          Hindsight Historical Learning:{' '}
                        </strong>
                        <span className="text-purple-800">{rec.historical_memory[0]}</span>
                      </div>
                    </div>
                  )}

                  {/* Experiment & Measurement */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-700">Measure via:</span>{' '}
                      {rec.measurement_criteria?.join(', ') || 'Organic clicks & position stability'}
                    </div>

                    {isRejected && rec.rejection_reason && (
                      <div className="text-rose-600 font-semibold">
                        Rejection reason: {rec.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                      className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      {isExpanded ? 'Less Details' : 'More Evidence'}
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setSelectedRecForDetail(rec)}
                    >
                      Full Dossier
                    </Button>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRejectingRec(rec)
                          setRejectionReason('')
                        }}
                        disabled={submittingAction}
                      >
                        <XCircle size={13} className="text-rose-500" />
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(rec.id)}
                        disabled={submittingAction}
                      >
                        <CheckCircle2 size={13} />
                        Approve Proposal
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
                        onClick={() =>
                          navigate(`/experiments?project=${selectedProjectId}&fromRec=${rec.id}`)
                        }
                        className="flex items-center gap-1.5"
                      >
                        <FlaskConical size={13} /> Launch Experiment
                      </Button>
                    </div>
                  )}

                  {rec.status === 'experiment_created' && (
                    <Button
                      variant="secondary"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Reject Recommendation
              </h3>
              <button
                onClick={() => setRejectingRec(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Please explain why this proposal is unsuitable. GEOlytics will retain this in Hindsight memory so future recommendations avoid similar patterns.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Does not align with current brand tone, or already planned in next sprint..."
                  rows={3}
                  required
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden p-0 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/80">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selectedRecForDetail.type} • {selectedRecForDetail.priority} priority
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedRecForDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecForDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Action to Take:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl font-semibold text-slate-900 border border-slate-200/80">
                  {selectedRecForDetail.action}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Reason & Underlying Cause:
                </span>
                <p className="text-slate-700 leading-relaxed">{selectedRecForDetail.reason}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Hypothesis:
                </span>
                <p className="text-slate-700 leading-relaxed">{selectedRecForDetail.hypothesis}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Suggested Experiment Protocol:
                </span>
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-950 leading-relaxed font-medium">
                  {selectedRecForDetail.suggested_experiment}
                </div>
              </div>

              {selectedRecForDetail.evidence && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Verifiable Evidence Points:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {selectedRecForDetail.evidence.map((ev, idx) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRecForDetail.affected_pages &&
                selectedRecForDetail.affected_pages.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Affected Pages:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedRecForDetail.affected_pages.map((p, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/80 flex justify-between items-center text-[11px] text-slate-500">
              <span>
                Status: <strong className="uppercase">{selectedRecForDetail.status}</strong>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecForDetail(null)}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
