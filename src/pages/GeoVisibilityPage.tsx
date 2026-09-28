import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bot,
  Plus,
  RotateCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Globe,
  Sparkles,
  X,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  ProviderCapability,
  ProviderStatusResponse,
  TrackedQuery,
  NormalizedAIResponse,
  QueryVisibilitySummary,
  CompetitorResearchResult,
} from '@/types'

export default function GeoVisibilityPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  // GEO State
  const [providers, setProviders] = useState<ProviderCapability[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [queries, setQueries] = useState<TrackedQuery[]>([])
  const [loadingQueries, setLoadingQueries] = useState(false)

  // Create Query Modal
  const [showAddQuery, setShowAddQuery] = useState(false)
  const [newQueryText, setNewQueryText] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [newTargetEntity, setNewTargetEntity] = useState('')
  const [creatingQuery, setCreatingQuery] = useState(false)

  // Execution State
  const [runningCheckQueryId, setRunningCheckQueryId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Query Detail Drawer
  const [selectedQueryForDetail, setSelectedQueryForDetail] = useState<TrackedQuery | null>(null)
  const [queryDetailResponses, setQueryDetailResponses] = useState<NormalizedAIResponse[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedProviderTab, setSelectedProviderTab] = useState<string>('openai')

  // Tavily Competitor Baseline Research State
  const [tavilyQuery, setTavilyQuery] = useState('')
  const [tavilyLoading, setTavilyLoading] = useState(false)
  const [tavilyResult, setTavilyResult] = useState<CompetitorResearchResult | null>(null)

  // 1. Load Projects
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

  // 2. Load Provider Statuses & Tracked Queries
  const loadGeoData = async (projectId: string) => {
    if (!projectId) return
    setLoadingProviders(true)
    setLoadingQueries(true)
    setErrorMessage('')

    try {
      const [provRes, queriesRes] = await Promise.all([
        api.get<ProviderStatusResponse>(`/api/v1/projects/${projectId}/geo/providers`),
        api.get<TrackedQuery[]>(`/api/v1/projects/${projectId}/geo/queries`),
      ])
      setProviders(provRes.providers || [])
      setQueries(queriesRes || [])
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load GEO status')
    } finally {
      setLoadingProviders(false)
      setLoadingQueries(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadGeoData(selectedProjectId)
    }
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id)
    setSearchParams({ project: id })
  }

  // 3. Create Tracked Query
  const handleCreateQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQueryText.trim() || !selectedProjectId) return
    setCreatingQuery(true)
    setErrorMessage('')

    try {
      await api.post(`/api/v1/projects/${selectedProjectId}/geo/queries`, {
        query: newQueryText.trim(),
        category: newCategory,
        target_entity: newTargetEntity.trim() || undefined,
      })
      setNewQueryText('')
      setNewCategory('general')
      setNewTargetEntity('')
      setShowAddQuery(false)
      await loadGeoData(selectedProjectId)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add query')
    } finally {
      setCreatingQuery(false)
    }
  }

  // 4. Trigger Visibility Check on a Query
  const handleRunVisibilityCheck = async (queryId: string) => {
    if (!selectedProjectId) return
    setRunningCheckQueryId(queryId)
    setErrorMessage('')

    try {
      const summary = await api.post<QueryVisibilitySummary>(
        `/api/v1/projects/${selectedProjectId}/geo/check`,
        { query_id: queryId }
      )
      // Refresh list to show updated visibility matrix
      await loadGeoData(selectedProjectId)
      // If modal is open for this query, update responses
      if (selectedQueryForDetail?.id === queryId) {
        setQueryDetailResponses(summary.responses)
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Visibility check failed')
    } finally {
      setRunningCheckQueryId(null)
    }
  }

  // 5. Open Query Detail Drawer
  const handleOpenDetail = async (q: TrackedQuery) => {
    setSelectedQueryForDetail(q)
    setLoadingDetail(true)
    try {
      const data = await api.get<{ checks: NormalizedAIResponse[] }>(
        `/api/v1/projects/${selectedProjectId}/geo/checks/${q.id}`
      )
      setQueryDetailResponses(data.checks || [])
      if (data.checks && data.checks.length > 0) {
        setSelectedProviderTab(data.checks[0].provider)
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load check details')
    } finally {
      setLoadingDetail(false)
    }
  }

  // 6. Run Tavily Competitor Baseline Research
  const handleRunTavilyResearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tavilyQuery.trim() || !selectedProjectId) return
    setTavilyLoading(true)
    setErrorMessage('')

    try {
      const res = await api.post<CompetitorResearchResult>(
        `/api/v1/projects/${selectedProjectId}/geo/research`,
        { query: tavilyQuery.trim() }
      )
      setTavilyResult(res)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Tavily research failed')
    } finally {
      setTavilyLoading(false)
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Bot size={18} />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              AI Visibility & GEO Intelligence
            </h1>
            <Badge variant="geo">AI Search Intelligence</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Observes whether your brand and website ({selectedProject?.website_url || 'target domain'}) are mentioned or cited in AI search completions across multiple providers.
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
            onClick={() => setShowAddQuery(true)}
          >
            <Plus size={14} /> Add Tracked Query
          </Button>
        </div>
      </div>

      {/* ── Strict Labeling / Disclaimer Banner ────────────────── */}
      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
        <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold">API-Observed AI Search Visibility:</strong> Measurements capture observable citations and source references returned by search-grounded API completions. This measures observable web citation presence and does NOT claim to represent an official consumer chat ranking.
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

      {/* ── Provider Status Overview ──────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Configured AI & Research Providers
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadGeoData(selectedProjectId)}
            disabled={loadingProviders}
          >
            <RotateCw size={12} className={loadingProviders ? 'animate-spin' : ''} />
            Refresh Status
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {providers.map((p) => {
            let statusBadge = (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                Not Configured
              </span>
            )
            if (p.status === 'connected') {
              statusBadge = (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ● Connected
                </span>
              )
            } else if (p.status === 'unavailable') {
              statusBadge = (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Unavailable
                </span>
              )
            } else if (p.status === 'error') {
              statusBadge = (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700">
                  Error
                </span>
              )
            }

            return (
              <Card key={p.provider} className="p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--color-text-primary)] capitalize">
                      {p.provider === 'openai' ? 'OpenAI' : p.provider === 'gemini' ? 'Google Gemini' : p.provider === 'claude' ? 'Claude' : p.provider === 'grok' ? 'xAI Grok' : 'Tavily'}
                    </span>
                    {statusBadge}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--color-text-tertiary)] mb-1">
                    {p.model}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2">
                    {p.message}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)]">
                  <span>Web Grounding:</span>
                  <span className={p.web_search_supported ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                    {p.web_search_supported ? 'Supported' : 'No Tools'}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Tracked Queries & Provider Comparison Matrix ──────── */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-secondary)] gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Tracked Queries & Provider Observation Matrix
            </h3>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Comparing whether your website was observed as a cited source or mentioned across independent AI search engines.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="font-bold">✓</span> Observed
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1 text-gray-500">
              <span className="font-bold">✗</span> Not observed
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1 text-gray-400">
              <span className="font-bold">—</span> Unavailable
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Tracked Query</th>
                <th className="py-2.5 px-3 font-medium">Category</th>
                <th className="py-2.5 px-3 font-medium text-center">OpenAI<br /><span className="text-[10px] font-normal text-gray-400">Mentioned | Cited</span></th>
                <th className="py-2.5 px-3 font-medium text-center">Gemini<br /><span className="text-[10px] font-normal text-gray-400">Mentioned | Cited</span></th>
                <th className="py-2.5 px-3 font-medium text-center">Claude<br /><span className="text-[10px] font-normal text-gray-400">Mentioned | Cited</span></th>
                <th className="py-2.5 px-3 font-medium text-center">Grok<br /><span className="text-[10px] font-normal text-gray-400">Mentioned | Cited</span></th>
                <th className="py-2.5 px-3 font-medium text-center">Citation Coverage</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loadingQueries ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Loading tracked queries...
                  </td>
                </tr>
              ) : queries.length > 0 ? (
                queries.map((q) => {
                  const latest = q.latest_visibility
                  const responses = latest?.responses || []

                  const getProviderObs = (pName: string) => {
                    const r = responses.find((resp) => resp.provider === pName)
                    if (!r || r.status === 'unavailable') {
                      return <span className="text-gray-400 font-mono">— &nbsp; | &nbsp; —</span>
                    }
                    if (r.status === 'failed') {
                      return <span className="text-red-500 font-mono text-[10px]">Failed</span>
                    }
                    return (
                      <span className="font-mono text-xs">
                        <span className={r.brand_mentioned ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                          {r.brand_mentioned ? '✓' : '✗'}
                        </span>
                        <span className="text-gray-300 mx-1.5">|</span>
                        <span className={r.website_cited ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                          {r.website_cited ? '✓' : '✗'}
                        </span>
                      </span>
                    )
                  }

                  const isChecking = runningCheckQueryId === q.id

                  return (
                    <tr key={q.id} className="hover:bg-[var(--color-surface-secondary)] transition-colors">
                      <td className="py-3 px-4 font-medium text-[var(--color-text-primary)] max-w-xs">
                        <button
                          onClick={() => handleOpenDetail(q)}
                          className="text-left hover:text-[var(--color-primary-600)] hover:underline flex items-center gap-1.5"
                        >
                          <span>{q.query}</span>
                          <ChevronRight size={12} className="text-gray-400 shrink-0" />
                        </button>
                        {q.target_entity && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Target Entity: <span className="text-gray-600">{q.target_entity}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 uppercase">
                          {q.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">{getProviderObs('openai')}</td>
                      <td className="py-3 px-3 text-center">{getProviderObs('gemini')}</td>
                      <td className="py-3 px-3 text-center">{getProviderObs('claude')}</td>
                      <td className="py-3 px-3 text-center">{getProviderObs('grok')}</td>

                      <td className="py-3 px-3 text-center">
                        {latest ? (
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-xs ${
                              latest.citation_coverage_pct > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {latest.citation_coverage_pct}%
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Pending check</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRunVisibilityCheck(q.id)}
                            disabled={isChecking}
                          >
                            <RotateCw size={11} className={isChecking ? 'animate-spin' : ''} />
                            {isChecking ? 'Checking...' : 'Check'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(q)}
                          >
                            Inspect
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No tracked queries yet. Click "+ Add Tracked Query" to observe AI search visibility.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Tavily Supporting Research Baseline ───────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Tavily Web & Competitor Baseline Research
          </h3>
          <Badge variant="seo">Public Web Baseline</Badge>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
          Independent search intelligence to discover competitor domains, high-ranking source pages, and related query topics without blending with Search Console data.
        </p>

        <form onSubmit={handleRunTavilyResearch} className="flex gap-2 max-w-2xl mb-4">
          <Input
            value={tavilyQuery}
            onChange={(e) => setTavilyQuery(e.target.value)}
            placeholder="e.g. best AI courses in Hyderabad"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={tavilyLoading || !tavilyQuery.trim()}
          >
            {tavilyLoading ? 'Researching...' : 'Run Research'}
          </Button>
        </form>

        {tavilyResult && (
          <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-[var(--color-text-primary)]">
              Identified Competitor & Source Domains ({tavilyResult.identified_domains.length}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tavilyResult.identified_domains.map((dom) => (
                <span
                  key={dom}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-[var(--color-border)] text-gray-700"
                >
                  {dom}
                </span>
              ))}
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">
                Top Public Source Results:
              </div>
              <div className="space-y-2">
                {tavilyResult.direct_results.map((r, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded border border-[var(--color-border)] text-xs">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>{r.title}</span>
                      <ExternalLink size={10} />
                    </a>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Add Tracked Query Modal ────────────────────────────── */}
      {showAddQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                Add Tracked Query
              </h3>
              <button
                onClick={() => setShowAddQuery(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuery} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Query String *
                </label>
                <Input
                  value={newQueryText}
                  onChange={(e) => setNewQueryText(e.target.value)}
                  placeholder="e.g. best AI courses in Hyderabad"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)]"
                >
                  <option value="general">General / Commercial</option>
                  <option value="competitor">Competitor Comparison</option>
                  <option value="local">Local Intent</option>
                  <option value="informational">Informational / How-To</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Target Entity / Brand Name (Optional)
                </label>
                <Input
                  value={newTargetEntity}
                  onChange={(e) => setNewTargetEntity(e.target.value)}
                  placeholder="e.g. GEOlytics"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddQuery(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={creatingQuery || !newQueryText.trim()}
                >
                  {creatingQuery ? 'Adding...' : 'Add Query'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Query Detail Modal / Drawer ────────────────────────── */}
      {selectedQueryForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-surface-secondary)]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Observed Query Detail
                </span>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  {selectedQueryForDetail.query}
                </h3>
              </div>
              <button
                onClick={() => setSelectedQueryForDetail(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            {/* Provider Tabs */}
            <div className="flex border-b border-[var(--color-border)] px-5 pt-3 gap-2 bg-[var(--color-surface)]">
              {['openai', 'gemini', 'claude', 'grok'].map((pName) => {
                const r = queryDetailResponses.find((res) => res.provider === pName)
                return (
                  <button
                    key={pName}
                    onClick={() => setSelectedProviderTab(pName)}
                    className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors capitalize ${
                      selectedProviderTab === pName
                        ? 'border-[var(--color-primary-600)] text-[var(--color-primary-600)]'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {pName === 'openai' ? 'OpenAI' : pName === 'gemini' ? 'Gemini' : pName === 'claude' ? 'Claude' : 'Grok'}
                    {r && r.status === 'completed' && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded ${r.website_cited ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        {r.website_cited ? 'Cited' : 'Not Cited'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Provider Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {(() => {
                if (loadingDetail) {
                  return (
                    <div className="py-12 text-center text-gray-400">
                      Loading observation details...
                    </div>
                  )
                }

                const activeRes = queryDetailResponses.find(
                  (res) => res.provider === selectedProviderTab
                )

                if (!activeRes) {
                  return (
                    <div className="py-12 text-center text-gray-400">
                      No check data recorded yet for this provider. Click "Check" on the main table to run an observation.
                    </div>
                  )
                }

                if (activeRes.status === 'unavailable') {
                  return (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                      <strong className="block font-semibold mb-1 text-gray-800">Capability Unavailable</strong>
                      {activeRes.error || 'This provider is either not configured or does not support live web citations via this API tier.'}
                    </div>
                  )
                }

                if (activeRes.status === 'failed') {
                  return (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <strong className="block font-semibold mb-1">Check Failed</strong>
                      {activeRes.error || 'Execution failed during request.'}
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {/* Status Highlights */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-3 rounded-lg border ${activeRes.website_cited ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        <span className="text-[11px] uppercase tracking-wider font-semibold block text-gray-500">
                          Website Citation Status
                        </span>
                        <div className="text-sm font-bold mt-0.5">
                          {activeRes.website_cited ? '✓ Observed as a Cited Source' : '✗ Not Observed as a Cited Source'}
                        </div>
                      </div>

                      <div className={`p-3 rounded-lg border ${activeRes.brand_mentioned ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        <span className="text-[11px] uppercase tracking-wider font-semibold block text-gray-500">
                          Brand Mention Status
                        </span>
                        <div className="text-sm font-bold mt-0.5">
                          {activeRes.brand_mentioned ? '✓ Brand Mentioned in Answer' : '✗ Brand Not Mentioned'}
                        </div>
                      </div>
                    </div>

                    {/* AI Answer Snippet */}
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                        API-Observed Model Completion ({activeRes.model})
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {activeRes.answer || 'No raw answer text captured.'}
                      </div>
                    </div>

                    {/* Observable Cited Sources */}
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                        Observable Cited Sources & URLs ({activeRes.sources?.length || 0})
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {activeRes.sources && activeRes.sources.length > 0 ? (
                          activeRes.sources.map((s, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded border flex items-center justify-between text-xs ${
                                s.is_own_domain
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : s.is_competitor
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] text-gray-400">#{s.order}</span>
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline truncate"
                                >
                                  {s.title || s.url}
                                </a>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {s.is_own_domain && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Target Website
                                  </span>
                                )}
                                {s.is_competitor && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                    Competitor
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-gray-500">
                                  {s.domain}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 italic">No structured sources grounded in this completion.</div>
                        )}
                      </div>
                    </div>

                    {/* Observed Competitor Domains */}
                    {activeRes.competitor_domains && activeRes.competitor_domains.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                          Competitor Domains Observed:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activeRes.competitor_domains.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 border border-amber-200 text-amber-800"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--color-border)] px-5 py-3 bg-[var(--color-surface-secondary)] flex justify-between items-center text-[11px] text-gray-500">
              <span>Observable source presence from search-grounded completions.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedQueryForDetail(null)}
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
