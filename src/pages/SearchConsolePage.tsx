import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  RotateCw,
  TrendingUp,
  MousePointer,
  Eye,
  Hash,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
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
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  SearchPerformanceReport,
} from '@/types'

export default function SearchConsolePage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  // GSC State
  const [days, setDays] = useState<number>(28)
  const [report, setReport] = useState<SearchPerformanceReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'queries' | 'pages'>('queries')

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
    setSearchParams({ project: id })
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

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Top Header & Project Switcher ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] flex items-center justify-center font-bold">
              <Search size={18} />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              Search Console Performance
            </h1>
            <Badge variant="seo">SEO Intelligence</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Official Google Search Console performance metrics (clicks, impressions, CTR, average position).
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

          {/* Time range selector */}
          <div className="flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setDays(7)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                days === 7
                  ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setDays(28)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                days === 28
                  ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              28d
            </button>
            <button
              onClick={() => setDays(90)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                days === 90
                  ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              90d
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerSync}
            disabled={syncing || !report}
          >
            <RotateCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync GSC'}
          </Button>
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

      {/* ── Unconnected State ──────────────────────────────────── */}
      {!loadingReport && !report && (
        <Card className="p-8 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            Connect Google Search Console
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mb-6">
            Authorize your Google account to automatically synchronize real search queries, clicks, impressions, and ranking positions for{' '}
            <strong className="text-[var(--color-text-primary)]">{selectedProject?.website_url}</strong>.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={handleConnectOAuth}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Authorize with Google'}
            </Button>
            <Button
              variant="outline"
              onClick={() => fetchReport(selectedProjectId, days)}
            >
              Check Again
            </Button>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-4">
            OAuth tokens are encrypted and kept strictly backend-only. Never shared with third parties.
          </p>
        </Card>
      )}

      {/* ── Connected GSC Performance Dashboard ───────────────── */}
      {report && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-2">
                <span>Total Clicks</span>
                <MousePointer size={14} className="text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {report.summary.total_clicks.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                Last {days} days
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-2">
                <span>Total Impressions</span>
                <Eye size={14} className="text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {report.summary.total_impressions.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                Last {days} days
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-2">
                <span>Average CTR</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {report.summary.average_ctr}%
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                Click-through rate
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-2">
                <span>Average Position</span>
                <Hash size={14} className="text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {report.summary.average_position.toFixed(1)}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                Lower is better
              </div>
            </Card>
          </div>

          {/* Performance Trend Chart */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Performance Over Time
                </h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Daily clicks and impressions from Google Search Console
                </p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickLine={false}
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
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend />
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
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                No timeseries data available for this range. Click "Sync GSC" to fetch the latest analytics.
              </div>
            )}
          </Card>

          {/* Top Queries / Top Pages Tables */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-secondary)]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('queries')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    activeTab === 'queries'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Top Search Queries ({report.top_queries?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('pages')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    activeTab === 'pages'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Top Landing Pages ({report.top_pages?.length || 0})
                </button>
              </div>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                Rankings represent Google Search Console observed metrics
              </span>
            </div>

            {activeTab === 'queries' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Query</th>
                      <th className="py-2.5 px-4 font-medium text-right">Clicks</th>
                      <th className="py-2.5 px-4 font-medium text-right">Impressions</th>
                      <th className="py-2.5 px-4 font-medium text-right">CTR</th>
                      <th className="py-2.5 px-4 font-medium text-right">Avg. Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {report.top_queries && report.top_queries.length > 0 ? (
                      report.top_queries.map((q, idx) => (
                        <tr key={idx} className="hover:bg-[var(--color-surface-secondary)] transition-colors">
                          <td className="py-2.5 px-4 font-medium text-[var(--color-text-primary)]">
                            {q.query}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-blue-600">
                            {q.clicks.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[var(--color-text-secondary)]">
                            {q.impressions.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[var(--color-text-secondary)]">
                            {q.ctr.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="px-2 py-0.5 rounded bg-gray-100 font-mono text-[11px]">
                              {q.position.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
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
                  <thead className="bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Landing Page</th>
                      <th className="py-2.5 px-4 font-medium text-right">Clicks</th>
                      <th className="py-2.5 px-4 font-medium text-right">Impressions</th>
                      <th className="py-2.5 px-4 font-medium text-right">CTR</th>
                      <th className="py-2.5 px-4 font-medium text-right">Avg. Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {report.top_pages && report.top_pages.length > 0 ? (
                      report.top_pages.map((p, idx) => (
                        <tr key={idx} className="hover:bg-[var(--color-surface-secondary)] transition-colors">
                          <td className="py-2.5 px-4 font-medium text-[var(--color-text-primary)] max-w-md truncate">
                            <a
                              href={p.page}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1.5"
                            >
                              <span>{p.page}</span>
                              <ExternalLink size={11} className="text-gray-400" />
                            </a>
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-blue-600">
                            {p.clicks.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[var(--color-text-secondary)]">
                            {p.impressions.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[var(--color-text-secondary)]">
                            {p.ctr.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="px-2 py-0.5 rounded bg-gray-100 font-mono text-[11px]">
                              {p.position.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
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
          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
            <span>
              Traditional SEO performance metrics are isolated from GEO/AI metrics. No estimated competitor data is blended into Google Search Console reports.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
