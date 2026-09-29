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
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
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
      await loadGeoData(selectedProjectId)
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
    console.log('[Tavily] Initiating live web research for query:', tavilyQuery.trim(), 'Project:', selectedProjectId)

    try {
      const res = await api.post<CompetitorResearchResult>(
        `/api/v1/projects/${selectedProjectId}/geo/research`,
        { query: tavilyQuery.trim() }
      )
      console.log('[Tavily] Live search response received:', res)
      if (res.status === 'failed' || res.error) {
        setErrorMessage(res.error || res.message || 'Tavily search failed. Please verify API configuration.')
      }
      setTavilyResult(res)
    } catch (err: unknown) {
      console.error('[Tavily] API error:', err)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Tavily search failed. Please check the Tavily API configuration.'
      )
    } finally {
      setTavilyLoading(false)
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

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
              AI Search Visibility & GEO Intelligence
            </h1>
            <Badge variant="geo">GEO Layer</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Observes whether your brand and domain ({selectedProject?.website_url || 'target domain'}) are mentioned or cited across AI search engines.
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
            onClick={() => setShowAddQuery(true)}
          >
            <Plus size={14} /> Add Tracked Query
          </Button>
        </div>
      </div>

      {/* ── Strict Labeling / Disclaimer Banner ────────────────── */}
      <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold text-blue-950">Search-Grounded AI Citation Benchmarking: </strong>
          Measurements inspect real citations and source references returned by search-enabled AI models. Independent from traditional Google SEO telemetry.
        </div>
      </div>

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

      {/* ── Provider Status Overview ──────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Bot size={13} className="text-purple-600" />
            Configured AI Engines & Providers
          </h2>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => loadGeoData(selectedProjectId)}
            disabled={loadingProviders}
          >
            <RotateCw size={12} className={loadingProviders ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {providers.map((p) => {
            const isConnected = p.status === 'connected'
            const isTavily = p.provider === 'tavily'
            let cited = 0
            let testedCount = 0
            queries.forEach((q) => {
              const resp = q.latest_visibility?.responses?.find((r) => r.provider === p.provider)
              if (resp) {
                testedCount++
                if (resp.website_cited || resp.brand_mentioned) cited++
              }
            })
            const hasData = testedCount > 0
            const citationPct = hasData ? Math.round((cited / testedCount) * 100) : null

            return (
              <Card
                key={p.provider}
                hoverLift
                className={`p-4 flex flex-col justify-between transition-all bg-white border border-slate-200 shadow-xs ${
                  isConnected ? 'border-t-2 border-t-purple-600' : 'border-t-2 border-t-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 capitalize">
                      {p.provider === 'openai'
                        ? 'OpenAI / ChatGPT'
                        : p.provider === 'gemini'
                        ? 'Google Gemini'
                        : p.provider === 'claude'
                        ? 'Anthropic Claude'
                        : p.provider === 'grok'
                        ? 'xAI Grok'
                        : 'Tavily'}
                    </span>
                    <Badge
                      variant={isConnected ? 'geo' : p.status === 'error' ? 'danger' : 'neutral'}
                      className="text-[9px] py-0"
                      dot
                    >
                      {isConnected ? (isTavily ? 'Active' : 'Live') : p.status}
                    </Badge>
                  </div>

                  {isTavily ? (
                    <div className="mb-2">
                      <div className="text-lg font-bold text-slate-900">
                        {isConnected ? 'Web Grounding' : 'Data unavailable'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Public web & competitor search
                      </div>
                    </div>
                  ) : hasData ? (
                    <div className="mb-2">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-2xl font-extrabold text-slate-900">{citationPct}%</span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {cited}/{testedCount} cited
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-purple-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${citationPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-2">
                      <div className="text-sm font-bold text-slate-400">
                        Data unavailable
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {queries.length === 0 ? 'No tracked queries' : 'Check not run yet'}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-slate-400 mb-1 truncate">
                    {p.model}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {p.message}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Grounding:</span>
                  <span
                    className={
                      p.web_search_supported ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                    }
                  >
                    {p.web_search_supported ? 'Web Search Live' : 'Standard'}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Tracked Queries & Provider Comparison Matrix ──────── */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Tracked Queries & Provider Observation Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Citation observations for {selectedProject?.website_url} across independent AI engines.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 size={13} /> Observed
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 text-slate-400">
              <XCircle size={13} /> Not Observed
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white text-slate-500 border-b border-slate-100 font-semibold">
              <tr>
                <th className="py-2.5 px-4">Tracked Search Query</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">
                  OpenAI
                  <span className="text-[10px] block font-normal text-slate-400">
                    Mention | Cited
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">
                  Gemini
                  <span className="text-[10px] block font-normal text-slate-400">
                    Mention | Cited
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">
                  Claude
                  <span className="text-[10px] block font-normal text-slate-400">
                    Mention | Cited
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">
                  Grok
                  <span className="text-[10px] block font-normal text-slate-400">
                    Mention | Cited
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">Citation Coverage</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingQueries ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading queries...
                  </td>
                </tr>
              ) : queries.length > 0 ? (
                queries.map((q) => {
                  const latest = q.latest_visibility
                  const responses = latest?.responses || []

                  const getProviderObs = (pName: string) => {
                    const r = responses.find((resp) => resp.provider === pName)
                    if (!r || r.status === 'unavailable') {
                      return <span className="text-slate-300 font-mono">— &nbsp; | &nbsp; —</span>
                    }
                    if (r.status === 'failed') {
                      return <span className="text-rose-500 font-mono text-[10px]">Failed</span>
                    }
                    return (
                      <span className="font-mono text-xs">
                        <span
                          className={
                            r.brand_mentioned ? 'text-emerald-600 font-bold' : 'text-slate-300'
                          }
                        >
                          {r.brand_mentioned ? '✓' : '✗'}
                        </span>
                        <span className="text-slate-200 mx-1.5">|</span>
                        <span
                          className={
                            r.website_cited ? 'text-emerald-600 font-bold' : 'text-slate-300'
                          }
                        >
                          {r.website_cited ? '✓' : '✗'}
                        </span>
                      </span>
                    )
                  }

                  const isChecking = runningCheckQueryId === q.id

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs">
                        <button
                          onClick={() => handleOpenDetail(q)}
                          className="text-left hover:text-blue-600 flex items-center gap-1.5"
                        >
                          <span>{q.query}</span>
                          <ChevronRight size={12} className="text-slate-400 shrink-0" />
                        </button>
                        {q.target_entity && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Target Entity: <span className="text-slate-600">{q.target_entity}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                          {q.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">{getProviderObs('openai')}</td>
                      <td className="py-3 px-3 text-center">{getProviderObs('gemini')}</td>
                      <td className="py-3 px-3 text-center">{getProviderObs('claude')}</td>
                      <td className="py-3 px-3 text-center">{getProviderObs('grok')}</td>

                      <td className="py-3 px-3 text-center">
                        {latest ? (
                          <Badge
                            variant={latest.citation_coverage_pct > 0 ? 'geo' : 'neutral'}
                            className="text-[11px]"
                          >
                            <AnimatedNumber value={latest.citation_coverage_pct} />%
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pending</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleRunVisibilityCheck(q.id)}
                            disabled={isChecking}
                          >
                            <RotateCw size={11} className={isChecking ? 'animate-spin' : ''} />
                            {isChecking ? 'Checking...' : 'Check'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
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
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No tracked queries yet. Click "+ Add Tracked Query" to observe AI search visibility.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Tavily Supporting Research Baseline ───────────────── */}
      <Card hoverLift className="p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <Globe size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Tavily Web & Competitor Baseline Research
          </h3>
          <Badge variant="seo">Public Web</Badge>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Discover competitor domains, high-ranking source pages, and related query topics via live web crawling.
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
            size="sm"
            disabled={tavilyLoading || !tavilyQuery.trim()}
          >
            {tavilyLoading ? 'Researching...' : 'Run Research'}
          </Button>
        </form>

        {tavilyResult && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-slide-down">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">
                  Search Results for: <span className="text-blue-600">"{tavilyResult.query}"</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Source: Tavily Web Search
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {tavilyResult.results_count || (tavilyResult.direct_results || tavilyResult.results || []).length} results found
              </span>
            </div>

            {tavilyResult.summary && (
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                {tavilyResult.summary}
              </p>
            )}

            {/* Identified Competitor & Source Domains */}
            {((tavilyResult.identified_domains || tavilyResult.competitor_domains_found || []).length > 0) ? (
              <div>
                <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <span>Identified Competitor & Source Domains</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    ({(tavilyResult.identified_domains || tavilyResult.competitor_domains_found || []).length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(tavilyResult.identified_domains || tavilyResult.competitor_domains_found || []).map((dom) => (
                    <span
                      key={dom}
                      className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white border border-slate-200 text-slate-700 shadow-2xs flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {dom}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No competitor domains identified in top search results.</p>
            )}

            {/* Top Web Source Results */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-800 mb-2">
                Top Web Source Results:
              </div>
              {(tavilyResult.direct_results || tavilyResult.results || []).length > 0 ? (
                <div className="space-y-2">
                  {(tavilyResult.direct_results || tavilyResult.results || []).map((r, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-2xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-600 hover:underline flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{r.title || r.url}</span>
                          <ExternalLink size={11} className="shrink-0" />
                        </a>
                        {r.domain && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {r.domain}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">
                        {r.content || r.snippet || 'No snippet content returned.'}
                      </p>
                      <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-2">
                        <span>Source: Tavily Web Search</span>
                        <span>•</span>
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline truncate">
                          {r.url}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                  No results returned for this search.
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Add Tracked Query Modal ────────────────────────────── */}
      {showAddQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Tracked Query</h3>
              <button
                onClick={() => setShowAddQuery(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateQuery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="general">General / Commercial</option>
                  <option value="competitor">Competitor Comparison</option>
                  <option value="local">Local Intent</option>
                  <option value="informational">Informational / How-To</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Entity / Brand Name (Optional)
                </label>
                <Input
                  value={newTargetEntity}
                  onChange={(e) => setNewTargetEntity(e.target.value)}
                  placeholder="e.g. GEOlytics"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddQuery(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden p-0 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/80">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Observed Query Detail
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedQueryForDetail.query}
                </h3>
              </div>
              <button
                onClick={() => setSelectedQueryForDetail(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            {/* Provider Tabs */}
            <div className="flex border-b border-slate-100 px-5 pt-3 gap-2 bg-white">
              {['openai', 'gemini', 'claude', 'grok'].map((pName) => {
                const r = queryDetailResponses.find((res) => res.provider === pName)
                return (
                  <button
                    key={pName}
                    onClick={() => setSelectedProviderTab(pName)}
                    className={`text-xs font-semibold px-4 py-2 border-b-2 transition-all capitalize ${
                      selectedProviderTab === pName
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {pName === 'openai'
                      ? 'OpenAI'
                      : pName === 'gemini'
                      ? 'Gemini'
                      : pName === 'claude'
                      ? 'Claude'
                      : 'Grok'}
                    {r && r.status === 'completed' && (
                      <span
                        className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          r.website_cited
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {r.website_cited ? 'Cited' : 'No Citation'}
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
                    <div className="py-12 text-center text-slate-400">
                      Loading observation details...
                    </div>
                  )
                }

                const activeRes = queryDetailResponses.find(
                  (res) => res.provider === selectedProviderTab
                )

                if (!activeRes) {
                  return (
                    <div className="py-12 text-center text-slate-400">
                      No check data recorded yet for this provider. Click "Check" on the main table to run an observation.
                    </div>
                  )
                }

                if (activeRes.status === 'unavailable') {
                  return (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                      <strong className="block font-semibold mb-1 text-slate-800">
                        Capability Unavailable
                      </strong>
                      {activeRes.error ||
                        'This provider is either not configured or does not support live web citations via this API tier.'}
                    </div>
                  )
                }

                if (activeRes.status === 'failed') {
                  return (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                      <strong className="block font-semibold mb-1">Check Failed</strong>
                      {activeRes.error || 'Execution failed during request.'}
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {/* Status Highlights */}
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className={`p-3.5 rounded-xl border ${
                          activeRes.website_cited
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-[11px] uppercase tracking-wider font-semibold block text-slate-500">
                          Website Citation Status
                        </span>
                        <div className="text-sm font-bold mt-0.5">
                          {activeRes.website_cited
                            ? '✓ Observed as a Cited Source'
                            : '✗ Not Observed as a Cited Source'}
                        </div>
                      </div>

                      <div
                        className={`p-3.5 rounded-xl border ${
                          activeRes.brand_mentioned
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-[11px] uppercase tracking-wider font-semibold block text-slate-500">
                          Brand Mention Status
                        </span>
                        <div className="text-sm font-bold mt-0.5">
                          {activeRes.brand_mentioned
                            ? '✓ Brand Mentioned in Answer'
                            : '✗ Brand Not Mentioned'}
                        </div>
                      </div>
                    </div>

                    {/* AI Answer Snippet */}
                    <div>
                      <div className="text-xs font-bold text-slate-900 mb-1">
                        API-Observed Model Completion ({activeRes.model})
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-700 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {activeRes.answer || 'No raw answer text captured.'}
                      </div>
                    </div>

                    {/* Observable Cited Sources */}
                    <div>
                      <div className="text-xs font-bold text-slate-900 mb-1">
                        Observable Cited Sources & URLs ({activeRes.sources?.length || 0})
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {activeRes.sources && activeRes.sources.length > 0 ? (
                          activeRes.sources.map((s, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                                s.is_own_domain
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : s.is_competitor
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] text-slate-400">
                                  #{s.order}
                                </span>
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
                                  <Badge variant="success" className="text-[10px] py-0">
                                    Target Domain
                                  </Badge>
                                )}
                                {s.is_competitor && (
                                  <Badge variant="warning" className="text-[10px] py-0">
                                    Competitor
                                  </Badge>
                                )}
                                <span className="text-[10px] font-mono text-slate-500">
                                  {s.domain}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400 italic">
                            No structured sources grounded in this completion.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/80 flex justify-between items-center text-[11px] text-slate-500">
              <span>Observable source presence from search-grounded completions.</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedQueryForDetail(null)}
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
