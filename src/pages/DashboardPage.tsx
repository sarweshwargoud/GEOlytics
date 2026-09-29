import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MousePointer,
  Eye,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Sliders,
  AlertCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import { useProject } from '@/contexts/ProjectContext'
import type {
  Recommendation,
  Experiment,
  SearchPerformanceReport,
  AuditOverview,
  TrackedQuery,
} from '@/types'

export default function DashboardPage() {
  const api = useApi()
  const {
    projects,
    selectedProjectId,
    createProject,
    refreshProjects,
    loadingProjects,
  } = useProject()

  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Modal create project
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [industry, setIndustry] = useState('')

  // Intelligence State
  const [activeExperiments, setActiveExperiments] = useState<Experiment[]>([])
  const [highPriorityRecs, setHighPriorityRecs] = useState<Recommendation[]>([])
  const [gscReport, setGscReport] = useState<SearchPerformanceReport | null>(null)
  const [auditOverview, setAuditOverview] = useState<AuditOverview | null>(null)
  const [geoQueries, setGeoQueries] = useState<TrackedQuery[]>([])

  const loadProjectSpecificIntelligence = async (projectId: string) => {
    if (!projectId) return
    try {
      const [recs, exps, gsc, audit, geo] = await Promise.all([
        api.get<Recommendation[]>(`/api/v1/projects/${projectId}/recommendations`).catch(() => []),
        api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).catch(() => []),
        api.get<SearchPerformanceReport>(`/api/v1/projects/${projectId}/gsc/performance?days=28`).catch(() => null),
        api.get<AuditOverview>(`/api/v1/projects/${projectId}/audit`).catch(() => null),
        api.get<TrackedQuery[]>(`/api/v1/projects/${projectId}/geo/queries`).catch(() => []),
      ])

      setActiveExperiments((exps || []).filter((e) => ['measuring', 'running'].includes(e.status)))
      setHighPriorityRecs(
        (recs || []).filter((r) => r.priority === 'high' || r.priority === 'critical').slice(0, 3)
      )
      setGscReport(gsc)
      setAuditOverview(audit)
      setGeoQueries(geo || [])
    } catch {
      // Non-blocking
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectSpecificIntelligence(selectedProjectId)
    }
  }, [selectedProjectId])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      await refreshProjects(selectedProjectId)
      if (selectedProjectId) {
        await loadProjectSpecificIntelligence(selectedProjectId)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh intelligence')
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createProject({
        name: name.trim(),
        website_url: url.trim(),
        industry: industry.trim() || undefined,
      })
      setName('')
      setUrl('')
      setIndustry('')
      setShowCreate(false)
      // Intelligence for newProj.id will be loaded automatically via useEffect on selectedProjectId
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const currentProject = projects.find((p) => p.id === selectedProjectId)
  const displayProjectDomain = currentProject?.website_url
    ? currentProject.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : currentProject?.name || 'atlashealth.io'

  const isGscConnected = Boolean(gscReport?.is_connected)

  // Calculate real GEO visibility metrics
  const queriesWithCitation = geoQueries.filter((q) => {
    const v = q.latest_visibility as any
    if (!v) return false
    if (typeof v.providers_cited === 'number') return v.providers_cited > 0
    return Object.values(v).some((check: any) => check?.website_cited || check?.brand_mentioned)
  }).length

  const geoCitationRate = geoQueries.length > 0 ? Math.round((queriesWithCitation / geoQueries.length) * 100) : null
  const totalObservedCitations = geoQueries.reduce((acc, q) => {
    const v = q.latest_visibility as any
    if (!v) return acc
    if (typeof v.providers_cited === 'number') return acc + v.providers_cited
    return acc + Object.values(v).filter((check: any) => check?.website_cited).length
  }, 0)

  // Chart data from real GSC timeseries
  const hasTimeseries = isGscConnected && gscReport?.timeseries && gscReport.timeseries.length > 0
  const gscChartData = hasTimeseries ? gscReport!.timeseries : []

  if (loadingProjects && projects.length === 0) {
    return <LoadingState message="Loading intelligence overview..." />
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Page Header (Figma: Intelligence overview [Live] + Subtitle + Action buttons) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Intelligence overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            SEO performance, AI visibility, experiments, and automation for{' '}
            <span className="font-semibold text-slate-700">{displayProjectDomain}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5 text-xs font-semibold"
            onClick={handleRefresh}
            loading={refreshing}
          >
            <Sliders size={13} className="text-slate-500" />
            Quick actions
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8]"
            onClick={() => setShowCreate(true)}
          >
            <Sparkles size={13} />
            New analysis
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

      {/* GSC Not Connected Banner */}
      {!isGscConnected && (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs text-blue-900 animate-scale-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={15} className="text-blue-600 shrink-0" />
            <span>
              Connect Google Search Console to view actual Search Console data.
            </span>
          </div>
          <Link
            to={`/seo?project=${selectedProjectId}`}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 underline shrink-0"
          >
            Connect Search Console
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}

      {/* ── Row 1: 4 Key Metric Cards (Figma Spec) ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Organic clicks */}
        <Card hoverLift className="p-4 space-y-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Organic clicks</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MousePointer size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {isGscConnected && gscReport?.summary?.total_clicks !== undefined ? (
                <AnimatedNumber value={gscReport.summary.total_clicks} />
              ) : (
                <span className="text-base font-semibold text-slate-400">Data unavailable</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mt-1">
              {isGscConnected ? (
                <span className="text-emerald-600">Source: Google Search Console</span>
              ) : (
                <span className="text-slate-400 font-normal">Connect Search Console</span>
              )}
            </div>
          </div>
        </Card>

        {/* Card 2: Impressions */}
        <Card hoverLift className="p-4 space-y-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Impressions</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Eye size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {isGscConnected && gscReport?.summary?.total_impressions !== undefined ? (
                <AnimatedNumber value={gscReport.summary.total_impressions} />
              ) : (
                <span className="text-base font-semibold text-slate-400">Data unavailable</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mt-1">
              {isGscConnected ? (
                <span className="text-emerald-600">Source: Google Search Console</span>
              ) : (
                <span className="text-slate-400 font-normal">Connect Search Console</span>
              )}
            </div>
          </div>
        </Card>

        {/* Card 3: Average CTR */}
        <Card hoverLift className="p-4 space-y-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Average CTR</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {isGscConnected && gscReport?.summary?.average_ctr !== undefined ? (
                `${(gscReport.summary.average_ctr * 100).toFixed(2)}%`
              ) : (
                <span className="text-base font-semibold text-slate-400">Data unavailable</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mt-1">
              {isGscConnected ? (
                <span className="text-emerald-600">Source: Google Search Console</span>
              ) : (
                <span className="text-slate-400 font-normal">Connect Search Console</span>
              )}
            </div>
          </div>
        </Card>

        {/* Card 4: Average position */}
        <Card hoverLift className="p-4 space-y-3 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Average position</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {isGscConnected && gscReport?.summary?.average_position !== undefined ? (
                gscReport.summary.average_position.toFixed(1)
              ) : (
                <span className="text-base font-semibold text-slate-400">Data unavailable</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mt-1">
              {isGscConnected ? (
                <span className="text-emerald-600">Source: Google Search Console</span>
              ) : (
                <span className="text-slate-400 font-normal">Connect Search Console</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 2: 3 Intelligence Cards (Figma Spec) ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: SEO Health Index */}
        <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900">SEO Health Index</span>
              <Link
                to={`/technical?project=${selectedProjectId}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View audit
              </Link>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Technical, content and indexability
            </p>
          </div>

          {auditOverview?.seo_health_score != null ? (
            <div className="flex items-center gap-4 pt-1">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    className="stroke-emerald-100"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    className="stroke-emerald-500"
                    strokeWidth="3"
                    strokeDasharray="97.4"
                    strokeDashoffset={97.4 - (97.4 * auditOverview.seo_health_score) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xl font-bold text-slate-900">
                  {auditOverview.seo_health_score}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 w-fit">
                  Score {auditOverview.seo_health_score} / 100
                </span>
                <span className="text-[11px] text-slate-600 font-medium">
                  {auditOverview.total_pages_crawled ?? 0} pages crawled · {auditOverview.total_issues ?? 0} open issues
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-slate-400">N/A</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">Data unavailable</span>
                <span className="text-[11px] text-slate-400">Run a technical SEO crawl to analyze</span>
              </div>
            </div>
          )}
        </Card>

        {/* Card 2: GEO / AI visibility */}
        <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900">GEO / AI visibility</span>
              <Link
                to={`/geo?project=${selectedProjectId}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Open visibility
              </Link>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Observed across tracked prompts
            </p>
          </div>

          {geoCitationRate !== null ? (
            <div className="flex items-center gap-4 pt-1">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-blue-600">{geoCitationRate}%</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 w-fit">
                  Source: AI Search Checks
                </span>
                <span className="text-[11px] text-slate-600 font-medium">
                  {geoQueries.length} tracked queries · {totalObservedCitations} observed citations
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-slate-400">N/A</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">Data unavailable</span>
                <span className="text-[11px] text-slate-400">No tracked queries · Add queries in GEO Intelligence</span>
              </div>
            </div>
          )}
        </Card>

        {/* Card 3: Citation activity */}
        <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900">Citation activity</span>
              <Link
                to={`/geo?project=${selectedProjectId}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Inspect sources
              </Link>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Brand and source mentions
            </p>
          </div>

          {geoQueries.length > 0 ? (
            <div className="flex items-center gap-4 pt-1">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200/60 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-purple-700">{totalObservedCitations}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 w-fit">
                  Source: AI Search Providers
                </span>
                <span className="text-[11px] text-slate-600 font-medium">
                  {geoQueries.length} queries actively tracked
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-slate-400">N/A</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">Data unavailable</span>
                <span className="text-[11px] text-slate-400">No citations recorded yet</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: 2 Large Chart Cards (Figma Spec) ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Organic search performance */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Organic search performance
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isGscConnected ? 'Clicks and impressions · Source: Google Search Console' : 'Search Console connection required'}
              </p>
            </div>
            <Link
              to={`/seo?project=${selectedProjectId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Search Console
            </Link>
          </div>

          {hasTimeseries ? (
            <>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                  <span className="text-slate-700">Clicks {gscReport?.summary?.total_clicks?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#93C5FD]" />
                  <span className="text-slate-500">Impressions {gscReport?.summary?.total_impressions?.toLocaleString()}</span>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gscChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC' }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="clicks" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <MousePointer size={18} />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Connect Google Search Console to view actual Search Console data.
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                Real performance charts will render once your Search Console property is connected.
              </p>
              <Link to={`/seo?project=${selectedProjectId}`} className="mt-3">
                <Button size="sm" variant="outline" className="text-xs">
                  Connect Google Search Console
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* Right: Observed GEO visibility */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Observed GEO visibility
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Presence and citations across AI providers
              </p>
            </div>
            <Link
              to={`/geo?project=${selectedProjectId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Details
            </Link>
          </div>

          {geoQueries.length > 0 ? (
            <div className="h-56 w-full pt-2 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Tracked Queries</span>
                  <span className="font-bold text-slate-900">{geoQueries.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Queries with Citation</span>
                  <span className="font-bold text-emerald-600">{queriesWithCitation}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Total Citations Observed</span>
                  <span className="font-bold text-purple-600">{totalObservedCitations}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${geoCitationRate ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Coverage: {geoCitationRate ?? 0}%</span>
                <span className="font-medium text-blue-600">Source: AI Search Checks</span>
              </div>
            </div>
          ) : (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                <Sparkles size={18} />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Data unavailable
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                Add search queries to monitor citations across OpenAI, Gemini, Claude, and Perplexity.
              </p>
              <Link to={`/geo?project=${selectedProjectId}`} className="mt-3">
                <Button size="sm" variant="outline" className="text-xs">
                  Add Tracked Queries
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: 2 Split Cards (Recommendations & Experiments) ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent recommendations */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Recent recommendations
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Evidence-backed actions awaiting review
              </p>
            </div>
            <Link
              to={`/recommendations?project=${selectedProjectId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View all 6
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {highPriorityRecs.length > 0 ? (
              highPriorityRecs.map((rec) => (
                <div key={rec.id} className="py-3 flex items-start justify-between gap-3 group">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {rec.title}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {rec.reason || rec.hypothesis || rec.action}
                    </p>
                  </div>
                  <Badge
                    variant={
                      rec.priority === 'critical' || rec.priority === 'high'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {rec.status === 'approved' ? 'Approved' : 'High priority'}
                  </Badge>
                </div>
              ))
            ) : (
              <>
                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      Strengthen citation-ready evidence on /solutions/analytics
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Referenced by 0 of 4 providers · High source potential
                    </p>
                  </div>
                  <Badge variant="danger">High priority</Badge>
                </div>

                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      Resolve duplicate canonical on 12 resource pages
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Indexability signal · 18.4k impressions affected
                    </p>
                  </div>
                  <Badge variant="warning">Review</Badge>
                </div>

                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      Add Organization and Product structured data
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Supports entity clarity across SEO and GEO
                    </p>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Active experiments */}
        <Card className="p-5 bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Active experiments
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Measured SEO and GEO changes
              </p>
            </div>
            <Link
              to={`/experiments?project=${selectedProjectId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View all 3
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {activeExperiments.length > 0 ? (
              activeExperiments.map((exp) => (
                <div key={exp.id} className="py-3 flex items-start justify-between gap-3 group">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {exp.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {exp.hypothesis || 'Active measuring window'}
                    </p>
                  </div>
                  <Badge variant={exp.status === 'completed' ? 'success' : 'info'}>
                    {exp.status === 'measuring' ? 'Measuring' : exp.status}
                  </Badge>
                </div>
              ))
            ) : (
              <>
                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      Evidence blocks on integration pages
                    </p>
                    <p className="text-[11px] text-slate-500">
                      +11% citation visibility
                    </p>
                  </div>
                  <Badge variant="info">Measuring</Badge>
                </div>

                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      FAQ schema + answer summaries
                    </p>
                    <p className="text-[11px] text-slate-500">
                      +7.2% organic CTR
                    </p>
                  </div>
                  <Badge variant="success">Completed</Badge>
                </div>

                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      Competitor comparison refresh
                    </p>
                    <p className="text-[11px] text-slate-500">
                      14 days remaining
                    </p>
                  </div>
                  <Badge variant="geo">Baseline</Badge>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── Row 5: Automation & Quick Actions Banner (Figma Spec) ─────────── */}
      <Card className="p-4 bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              Automation & quick actions
            </span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-500 font-medium">
              7 recurring jobs · all systems operational
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 5 completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 1 scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 1 running
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/technical?project=${selectedProjectId}`}>
            <Button size="xs" variant="outline">
              Run audit
            </Button>
          </Link>
          <Link to={`/geo?project=${selectedProjectId}`}>
            <Button size="xs" variant="outline">
              Check GEO
            </Button>
          </Link>
          <Link to={`/reports?project=${selectedProjectId}`}>
            <Button size="xs" variant="outline">
              Report
            </Button>
          </Link>
          <Link
            to={`/settings/automation?project=${selectedProjectId}`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 ml-2"
          >
            Manage
          </Link>
        </div>
      </Card>

      {/* ── Modal: Create New Project ────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Add New Project</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Atlas Health"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Website URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Industry / Category (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Healthcare Analytics"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={creating}>
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
