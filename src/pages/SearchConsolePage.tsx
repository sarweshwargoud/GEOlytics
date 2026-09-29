import { useState, useEffect } from 'react'
import {
  RotateCw,
  TrendingUp,
  MousePointer,
  Eye,
  Hash,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import { useProject } from '@/contexts/ProjectContext'
import type {
  SearchPerformanceReport,
  CompetitorResearchResult,
} from '@/types'

export default function SearchConsolePage() {
  const api = useApi()
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loadingProjects,
  } = useProject()

  // GSC State
  const [days, setDays] = useState<number>(28)
  const [report, setReport] = useState<SearchPerformanceReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'queries' | 'pages'>('queries')
  const [selectedMetric, setSelectedMetric] = useState<'clicks' | 'impressions' | 'both'>('both')

  // Web Search Fallback State (when GSC is unconnected or unavailable)
  const [fallbackQuery, setFallbackQuery] = useState('')
  const [runningFallback, setRunningFallback] = useState(false)
  const [fallbackResult, setFallbackResult] = useState<CompetitorResearchResult | null>(null)
  const [fallbackError, setFallbackError] = useState('')

  // 2. Fetch GSC Performance Report when project or days change
  const fetchReport = async (projectId: string, periodDays: number) => {
    if (!projectId) return
    setLoadingReport(true)
    setErrorMessage('')
    try {
      const data = await api.get<SearchPerformanceReport>(
        `/api/v1/projects/${projectId}/gsc/performance?days=${periodDays}`
      )
      setReport(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Search Console report'
      // 404 or missing connection is expected before OAuth connection
      if (msg.includes('404') || msg.includes('No active Google Search Console')) {
        setReport(null)
      } else {
        setErrorMessage(msg)
      }
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      fetchReport(selectedProjectId, days)
    }
  }, [selectedProjectId, days]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id)
  }

  // 3. Connect GSC via OAuth
  const handleConnectOAuth = async () => {
    if (!selectedProjectId) return
    setConnecting(true)
    setErrorMessage('')
    try {
      const res = await api.get<{ auth_url: string }>(
        `/api/v1/projects/${selectedProjectId}/gsc/auth-url`
      )
      if (res.auth_url) {
        window.location.href = res.auth_url
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Google Search Console OAuth is not configured on this server.'
      )
    } finally {
      setConnecting(false)
    }
  }

  // 4. Trigger Data Sync
  const handleTriggerSync = async () => {
    if (!selectedProjectId) return
    setSyncing(true)
    setErrorMessage('')
    try {
      await api.post(`/api/v1/projects/${selectedProjectId}/gsc/sync`, { days })
      await fetchReport(selectedProjectId, days)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  useEffect(() => {
    if (selectedProject?.website_url && !fallbackQuery) {
      setFallbackQuery(selectedProject.website_url.replace(/^https?:\/\//, '').replace(/\/$/, ''))
    }
  }, [selectedProjectId, projects, selectedProject, fallbackQuery])

  const handleRunWebSearchFallback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fallbackQuery.trim() || !selectedProjectId) return
    setRunningFallback(true)
    setFallbackError('')
    console.log('[SearchConsole] Running web search fallback for query:', fallbackQuery.trim())

    try {
      const res = await api.post<CompetitorResearchResult>(
        `/api/v1/projects/${selectedProjectId}/gsc/web-search-fallback`,
        { query: fallbackQuery.trim() }
      )
      console.log('[SearchConsole] Web search fallback result:', res)
      if (res.status === 'failed' || res.error) {
        setFallbackError(res.error || res.message || 'Web search query failed.')
      }
      setFallbackResult(res)
    } catch (err: unknown) {
      console.error('[SearchConsole] Web search error:', err)
      setFallbackError(err instanceof Error ? err.message : 'Web search fallback query failed.')
    } finally {
      setRunningFallback(false)
    }
  }

  const isGscConnected = Boolean(report && report.is_connected)

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* ── Top Header & Project Switcher ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Google Search Console
            </h1>
            {isGscConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected · Live sync
              </span>
            ) : (
              <Badge variant="neutral">Search Console Not Connected</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>Verified Google search clicks, impressions, CTR, and average positions</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock size={11} /> 48–72h official latency
            </span>
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

          {/* Time range selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium border border-slate-200/80">
            {[7, 28, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md transition-all ${
                  days === d
                    ? 'bg-white text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleTriggerSync}
            disabled={syncing || !isGscConnected}
          >
            <RotateCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync GSC'}
          </Button>
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

      {/* ── Unconnected State (Strictly shown when GSC not authenticated) ── */}
      {!loadingReport && !isGscConnected && (
        <div className="space-y-6">
          <Card className="p-8 text-center border-dashed border-slate-300 bg-white">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Connect Google Search Console to view actual Search Console data.
            </h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mb-6 leading-relaxed">
              Google Search Console is not connected for <strong className="text-slate-800 font-semibold">{selectedProject?.website_url}</strong>. Authenticate to synchronize real search queries, clicks, impressions, and ranking positions.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnectOAuth}
                disabled={connecting}
              >
                {connecting ? 'Connecting...' : 'Authorize with Google'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchReport(selectedProjectId, days)}
              >
                Check Again
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              OAuth tokens are encrypted and kept strictly backend-only. Never shared with third parties.
            </p>
          </Card>

          {/* ── Web Search Fallback Section ──────────────────────── */}
          <Card hoverLift className="p-5 border-blue-200/80 bg-gradient-to-r from-blue-50/20 via-white to-indigo-50/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Public Web Search Intelligence Fallback
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Source: Tavily Web Search
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Search Console is not connected yet. Use the live web search capability to query public web sources, inspect your domain's organic appearance, and identify competitors.
            </p>

            <form onSubmit={handleRunWebSearchFallback} className="flex gap-2 max-w-2xl mb-4">
              <Input
                value={fallbackQuery}
                onChange={(e) => setFallbackQuery(e.target.value)}
                placeholder="Search web for domain, topic, or competitors..."
                className="flex-1"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={runningFallback || !fallbackQuery.trim()}
              >
                {runningFallback ? 'Searching Web...' : 'Run Web Search'}
              </Button>
            </form>

            {fallbackError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg mb-3">
                {fallbackError}
              </div>
            )}

            {fallbackResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-slide-down">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">
                      Results for: <span className="text-blue-600">"{fallbackResult.query}"</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      (Web Search Fallback · Separate from GSC)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {fallbackResult.results_count || (fallbackResult.direct_results || fallbackResult.results || []).length} results found
                  </span>
                </div>

                {fallbackResult.summary && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                    {fallbackResult.summary}
                  </p>
                )}

                {/* Discovered Domains */}
                {((fallbackResult.identified_domains || fallbackResult.competitor_domains_found || []).length > 0) && (
                  <div>
                    <div className="text-xs font-bold text-slate-800 mb-1.5">
                      Discovered Competitor & Source Domains:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(fallbackResult.identified_domains || fallbackResult.competitor_domains_found || []).map((dom) => (
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
                )}

                {/* Top Web Source Results */}
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Top Web Search Results:
                  </div>
                  {(fallbackResult.direct_results || fallbackResult.results || []).length > 0 ? (
                    <div className="space-y-2">
                      {(fallbackResult.direct_results || fallbackResult.results || []).map((r, idx) => (
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
        </div>
      )}

      {loadingReport && (
        <LoadingState message="Fetching Search Console metrics..." type="skeleton" />
      )}

      {/* ── Connected GSC Performance Dashboard (Strictly rendered when isGscConnected) ── */}
      {isGscConnected && report && (
        <>
          {/* Verified Google Connection Banner */}
          <div className="bg-emerald-50/90 border border-emerald-200/90 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                Verified Google Search Console Connection · Property: <code className="bg-emerald-100/80 px-1.5 py-0.5 rounded text-emerald-950 font-mono text-[11px]">{report.site_url || selectedProject?.website_url || 'Verified Property'}</code> · Fresh telemetry
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Source: Google Search Console
              </span>
              <button
                onClick={handleConnectOAuth}
                className="text-emerald-700 hover:text-emerald-900 font-semibold underline text-[11px] cursor-pointer"
              >
                Re-authenticate
              </button>
            </div>
          </div>

          {/* Summary KPI Cards with Selection */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Clicks */}
            <Card
              hoverLift
              interactive
              onClick={() => setSelectedMetric(selectedMetric === 'clicks' ? 'both' : 'clicks')}
              className={`p-4 transition-all ${
                selectedMetric === 'clicks' ? 'ring-2 ring-blue-500 border-blue-400' : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Total Clicks</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MousePointer size={14} />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                <AnimatedNumber value={report.summary.total_clicks} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Last {days} days</span>
                <span className="text-blue-600 font-medium">Source: GSC</span>
              </div>
            </Card>

            {/* 2. Total Impressions */}
            <Card
              hoverLift
              interactive
              onClick={() =>
                setSelectedMetric(selectedMetric === 'impressions' ? 'both' : 'impressions')
              }
              className={`p-4 transition-all ${
                selectedMetric === 'impressions' ? 'ring-2 ring-purple-500 border-purple-400' : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Total Impressions</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Eye size={14} />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                <AnimatedNumber value={report.summary.total_impressions} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Last {days} days</span>
                <span className="text-purple-600 font-medium">Source: GSC</span>
              </div>
            </Card>

            {/* 3. Average CTR */}
            <Card hoverLift className="p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Average CTR</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {report.summary.average_ctr}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Click-through rate</span>
                <span className="text-emerald-600 font-medium">Source: GSC</span>
              </div>
            </Card>

            {/* 4. Average Position */}
            <Card hoverLift className="p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Average Position</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Hash size={14} />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {report.summary.average_position.toFixed(1)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Rank (lower is better)</span>
                <span className="text-amber-600 font-medium">Source: GSC</span>
              </div>
            </Card>
          </div>

          {/* Performance Trend Chart */}
          <Card hoverLift className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Search Performance Over Time
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily clicks and impressions from Google Search Console
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMetric('both')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    selectedMetric === 'both'
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Series
                </button>
              </div>
            </div>

            {report.timeseries && report.timeseries.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.timeseries}>
                    <defs>
                      <linearGradient id="clicksG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="impressionsG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#2563eb"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#9333ea"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.08)',
                      }}
                    />
                    <Legend />
                    {(selectedMetric === 'clicks' || selectedMetric === 'both') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="clicks"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#clicksG)"
                        name="Clicks"
                      />
                    )}
                    {(selectedMetric === 'impressions' || selectedMetric === 'both') && (
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="impressions"
                        stroke="#9333ea"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#impressionsG)"
                        name="Impressions"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                No timeseries data available for this range. Click "Sync GSC" to fetch the latest analytics.
              </div>
            )}
          </Card>

          {/* Top Queries / Top Pages Tables */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80 gap-2">
              <div className="flex items-center gap-1.5 bg-slate-200/60 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveTab('queries')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                    activeTab === 'queries'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top Search Queries ({report.top_queries?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('pages')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                    activeTab === 'pages'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top Landing Pages ({report.top_pages?.length || 0})
                </button>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Google Search Console observed rankings
              </span>
            </div>

            {activeTab === 'queries' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white text-slate-500 border-b border-slate-100 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Search Query</th>
                      <th className="py-2.5 px-4 text-right">Clicks</th>
                      <th className="py-2.5 px-4 text-right">Impressions</th>
                      <th className="py-2.5 px-4 text-right">CTR</th>
                      <th className="py-2.5 px-4 text-right">Avg. Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.top_queries && report.top_queries.length > 0 ? (
                      report.top_queries.map((q, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            {q.query}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-blue-600">
                            {q.clicks.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600 font-medium">
                            {q.impressions.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600 font-medium">
                            {q.ctr.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                              {q.position.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No query analytics recorded in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'pages' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white text-slate-500 border-b border-slate-100 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Landing Page URL</th>
                      <th className="py-2.5 px-4 text-right">Clicks</th>
                      <th className="py-2.5 px-4 text-right">Impressions</th>
                      <th className="py-2.5 px-4 text-right">CTR</th>
                      <th className="py-2.5 px-4 text-right">Avg. Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.top_pages && report.top_pages.length > 0 ? (
                      report.top_pages.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-slate-800 max-w-md truncate">
                            <a
                              href={p.page}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline hover:text-blue-600 flex items-center gap-1.5"
                            >
                              <span className="truncate">{p.page}</span>
                              <ExternalLink size={11} className="text-slate-400 shrink-0" />
                            </a>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-blue-600">
                            {p.clicks.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600 font-medium">
                            {p.impressions.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600 font-medium">
                            {p.ctr.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                              {p.position.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No page analytics recorded in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Diagnostic Note */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
            <span>
              Traditional SEO performance metrics are isolated from GEO/AI metrics. No estimated competitor data is blended into Google Search Console reports.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
