import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Bot,
  Globe,
  X,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { EmptyState, LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import { useProject } from '@/contexts/ProjectContext'
import type {
  AuditOverview,
  SEOIssue,
  CrawlPage,
} from '@/types'

export default function AuditPage() {
  const api = useApi()
  const {
    projects,
    selectedProjectId,
    loadingProjects,
  } = useProject()

  // Audit state
  const [overview, setOverview] = useState<AuditOverview | null>(null)
  const [issues, setIssues] = useState<SEOIssue[]>([])
  const [pages, setPages] = useState<CrawlPage[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [triggeringCrawl, setTriggeringCrawl] = useState(false)
  const [crawlError, setCrawlError] = useState('')

  // Filters & Page Search
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [pageSearchQuery, setPageSearchQuery] = useState('')
  const [selectedPage, setSelectedPage] = useState<CrawlPage | null>(null)
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null)

  // Active polling reference
  const pollTimerRef = useRef<number | null>(null)

  // 2. Fetch audit data when project changes
  const fetchAuditData = async (projId: string) => {
    if (!projId) return
    setLoadingAudit(true)
    setCrawlError('')
    try {
      const [auditData, issuesData, pagesData] = await Promise.all([
        api.get<AuditOverview>(`/api/v1/projects/${projId}/audit`),
        api.get<SEOIssue[]>(`/api/v1/projects/${projId}/audit/issues`),
        api.get<CrawlPage[]>(`/api/v1/projects/${projId}/audit/pages`),
      ])
      setOverview(auditData)
      setIssues(issuesData)
      setPages(pagesData)

      // If crawl is currently running, continue polling
      const runStatus = auditData?.latest_run?.status
      if (runStatus === 'queued' || runStatus === 'crawling' || runStatus === 'analyzing') {
        startPolling(projId)
      } else {
        stopPolling()
      }
    } catch (err: unknown) {
      setCrawlError(err instanceof Error ? err.message : 'Failed to fetch audit data')
    } finally {
      setLoadingAudit(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      fetchAuditData(selectedProjectId)
    }
    return () => stopPolling()
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = (projId: string) => {
    stopPolling()
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const auditData = await api.get<AuditOverview>(`/api/v1/projects/${projId}/audit`)
        setOverview(auditData)
        const st = auditData?.latest_run?.status
        if (st === 'completed' || st === 'failed') {
          stopPolling()
          fetchAuditData(projId)
        }
      } catch (e) {
        console.error('Polling error', e)
      }
    }, 2500)
  }

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  // 3. Trigger new crawl
  const handleRunAudit = async () => {
    if (!selectedProjectId) return
    setTriggeringCrawl(true)
    setCrawlError('')
    try {
      await api.post(`/api/v1/projects/${selectedProjectId}/crawl`, {
        max_pages: 25,
        max_depth: 3,
      })
      fetchAuditData(selectedProjectId)
    } catch (err: unknown) {
      setCrawlError(err instanceof Error ? err.message : 'Failed to trigger audit')
    } finally {
      setTriggeringCrawl(false)
    }
  }

  const currentProject = projects.find((p) => p.id === selectedProjectId)
  const latestRun = overview?.latest_run
  const isCrawlActive =
    latestRun?.status === 'queued' ||
    latestRun?.status === 'crawling' ||
    latestRun?.status === 'analyzing'

  // Filter issues
  const filteredIssues = issues.filter((i) => {
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
    return true
  })

  // Filter crawled pages
  const filteredPages = pages.filter((p) => {
    if (!pageSearchQuery) return true
    const q = pageSearchQuery.toLowerCase()
    return p.url.toLowerCase().includes(q) || (p.title && p.title.toLowerCase().includes(q))
  })

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Globe size={22} />
            </div>
          }
          title="No projects found"
          description="Create a project first before running technical SEO crawls and audits."
          action={
            <Link to="/dashboard">
              <Button size="sm">Go to Dashboard</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const healthScore = latestRun?.seo_health_score ?? 0
  const scoreColor =
    healthScore >= 80 ? 'text-emerald-600' : healthScore >= 50 ? 'text-amber-600' : 'text-rose-600'
  const strokeColor =
    healthScore >= 80 ? '#059669' : healthScore >= 50 ? '#d97706' : '#dc2626'
  const circumference = 2 * Math.PI * 40
  const strokeDashoffset = circumference - (healthScore / 100) * circumference

  return (
    <div className="space-y-6 max-w-7xl pb-16 animate-fade-in">
      {/* ── Top Bar (Figma: SEO Audit [Crawl complete] + Actions) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              SEO Audit
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200/60">
              Crawl complete
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Technical SEO, content, indexability, structured data, and GEO-readiness signals. The Health Index is an internal diagnostic—not a search ranking score.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunAudit}
            disabled={isCrawlActive}
            className="text-xs font-semibold"
          >
            Crawl settings
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleRunAudit}
            loading={triggeringCrawl || isCrawlActive}
            disabled={isCrawlActive}
            className="text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            {isCrawlActive ? (
              <>
                <RotateCw size={13} className="animate-spin" />
                {latestRun?.status === 'crawling' ? 'Crawling Pages...' : 'Analyzing SEO...'}
              </>
            ) : (
              <>
                <Play size={13} /> Run new audit
              </>
            )}
          </Button>
        </div>
      </div>

      {crawlError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between animate-scale-in">
          <span>{crawlError}</span>
          <button onClick={() => setCrawlError('')} className="font-semibold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Active Crawl Progress Banner ─────────────────────── */}
      {isCrawlActive && (
        <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-center justify-between shadow-xs animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <RotateCw size={16} className="animate-spin" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-950">
                Audit in progress for {currentProject?.website_url}
              </p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Phase: <span className="font-semibold uppercase">{latestRun?.status}</span> · Inspecting pages, directives, and structured data
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 bg-white px-2.5 py-1 rounded-full border border-blue-200">
            Auto-refreshing
          </span>
        </div>
      )}

      {/* ── Loading State ────────────────────────────────────── */}
      {loadingAudit && !overview && (
        <LoadingState message="Fetching technical audit data..." type="skeleton" />
      )}

      {/* ── Empty State: No Crawl Runs Yet ──────────────────── */}
      {!loadingAudit && !latestRun && (
        <Card className="py-12">
          <EmptyState
            icon={
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wrench size={22} />
              </div>
            }
            title="No SEO audit completed yet"
            description={`Run an automated crawl and technical audit for ${currentProject?.website_url}. Our crawler will discover on-page issues, schema markup, and AI bot directives.`}
            action={
              <Button size="sm" onClick={handleRunAudit} loading={triggeringCrawl}>
                <Play size={13} /> Run your first audit
              </Button>
            }
          />
        </Card>
      )}

      {/* ── Failed State ────────────────────────────────────── */}
      {latestRun && latestRun.status === 'failed' && (
        <Card className="border-rose-200 bg-rose-50/60 p-5">
          <div className="flex items-start gap-3.5">
            <XCircle size={22} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-rose-900">
                Crawl & Audit Failed
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Reason: {latestRun.error || 'The crawler encountered an unhandled network error.'}
              </p>
              <div className="mt-3">
                <Button size="sm" variant="danger" onClick={handleRunAudit} loading={triggeringCrawl}>
                  Retry Audit
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Completed Audit Results ─────────────────────────── */}
      {latestRun && latestRun.status === 'completed' && (
        <>
          {/* Top 2 Diagnostic Cards (Figma Spec) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. SEO Health Index Card */}
            <Card hoverLift className="p-5 flex flex-col justify-between bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  SEO Health Index
                </span>
                <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                  View audit log
                </span>
              </div>

              <div className="flex items-center gap-5 my-auto py-2">
                {/* Circular SVG Gauge */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-slate-100"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke={strokeColor}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-extrabold ${scoreColor}`}>
                      {latestRun.seo_health_score !== undefined && latestRun.seo_health_score !== null ? (
                        <AnimatedNumber value={latestRun.seo_health_score} />
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">N/A</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {latestRun.seo_health_score !== undefined && latestRun.seo_health_score !== null
                      ? 'Diagnostic evaluation across technical, on-page, and schema factors.'
                      : 'Audit completed. Diagnostic scores are computed based on crawled pages and issues.'}
                  </p>
                  <div>
                    {latestRun.seo_health_score !== undefined && latestRun.seo_health_score !== null ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Health Score {latestRun.seo_health_score} / 100
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                        Score pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Diagnostic evaluation across technical, on-page, and schema factors.
              </div>
            </Card>

            {/* 2. Crawl Coverage Card (Figma: 4 columns + status banner) */}
            <Card hoverLift className="p-5 flex flex-col justify-between bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    Crawl Coverage
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {latestRun.completed_at
                      ? `Completed ${new Date(latestRun.completed_at).toLocaleString()}`
                      : latestRun.status
                        ? `Status: ${latestRun.status}`
                        : 'No completed crawls'}
                  </span>
                </div>
                <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">
                  View crawl log
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 py-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xl font-bold text-slate-900 block">
                    {latestRun.pages_crawled !== undefined && latestRun.pages_crawled !== null ? (
                      <AnimatedNumber value={latestRun.pages_crawled} />
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Pages crawled</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xl font-bold text-slate-900 block">
                    {latestRun.pages_crawled !== undefined && latestRun.pages_failed !== undefined ? (
                      <AnimatedNumber value={Math.max(0, (latestRun.pages_crawled ?? 0) - (latestRun.pages_failed ?? 0))} />
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Indexable</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xl font-bold text-slate-900 block">
                    {latestRun.pages_failed !== undefined && latestRun.pages_failed !== null ? (
                      <AnimatedNumber value={latestRun.pages_failed} />
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Excluded / Failed</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xl font-bold text-rose-600 block">
                    {overview?.total_issues !== undefined && overview?.total_issues !== null ? (
                      <AnimatedNumber value={overview.total_issues} />
                    ) : issues.length > 0 ? (
                      <AnimatedNumber value={issues.length} />
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Issues</span>
                </div>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                <span>
                  {latestRun.completed_at
                    ? `Crawl data completed on ${new Date(latestRun.completed_at).toLocaleDateString()}.`
                    : 'Crawl completed.'}
                </span>
              </div>
            </Card>
          </div>

          {/* ── 5 Category Cards (Figma Spec) ────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. Technical SEO */}
            <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold truncate">Technical SEO</span>
                <span className="text-lg font-bold text-slate-900">
                  {latestRun.category_scores?.technical !== undefined && latestRun.category_scores?.technical !== null ? (
                    `${latestRun.category_scores.technical}`
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {issues.filter((i) => i.category === 'technical' && i.severity === 'critical').length} critical ·{' '}
                {issues.filter((i) => i.category === 'technical' && i.severity !== 'critical').length} warnings
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${latestRun.category_scores?.technical ?? 0}%` }}
                />
              </div>
            </Card>

            {/* 2. Content */}
            <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold truncate">Content</span>
                <span className="text-lg font-bold text-slate-900">
                  {(latestRun.category_scores?.on_page ?? latestRun.category_scores?.content) !== undefined &&
                  (latestRun.category_scores?.on_page ?? latestRun.category_scores?.content) !== null ? (
                    `${latestRun.category_scores?.on_page ?? latestRun.category_scores?.content}`
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {issues.filter((i) => i.category === 'content' || i.category === 'on_page').length} issues found
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{ width: `${(latestRun.category_scores?.on_page ?? latestRun.category_scores?.content) ?? 0}%` }}
                />
              </div>
            </Card>

            {/* 3. Indexability */}
            <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold truncate">Indexability</span>
                <span className="text-lg font-bold text-slate-900">
                  {latestRun.category_scores?.indexability !== undefined && latestRun.category_scores?.indexability !== null ? (
                    `${latestRun.category_scores.indexability}`
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {issues.filter((i) => i.category === 'indexability').length} indexability issues
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${latestRun.category_scores?.indexability ?? 0}%` }}
                />
              </div>
            </Card>

            {/* 4. Structured data */}
            <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold truncate">Structured data</span>
                <span className="text-lg font-bold text-slate-900">
                  {latestRun.category_scores?.structured_data !== undefined && latestRun.category_scores?.structured_data !== null ? (
                    `${latestRun.category_scores.structured_data}`
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {issues.filter((i) => i.category === 'structured_data').length} schema issues
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${latestRun.category_scores?.structured_data ?? 0}%` }}
                />
              </div>
            </Card>

            {/* 5. GEO technical signals */}
            <Card hoverLift className="p-4 bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold truncate">GEO signals</span>
                <span className="text-lg font-bold text-slate-900">
                  {(latestRun.category_scores as Record<string, any>)?.geo_readiness !== undefined &&
                  (latestRun.category_scores as Record<string, any>)?.geo_readiness !== null ? (
                    `${(latestRun.category_scores as Record<string, any>)?.geo_readiness}`
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Data unavailable</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {issues.filter((i) => (i.category as string) === 'geo' || (i.category as string) === 'ai').length} readiness gaps
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full"
                  style={{ width: `${(latestRun.category_scores as Record<string, any>)?.geo_readiness ?? 0}%` }}
                />
              </div>
            </Card>
          </div>

          {/* ── GEO Technical Signals & Directives Section ───────── */}
          <Card hoverLift>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  GEO Technical Signals & AI Crawler Directives
                </h3>
              </div>
              <Badge variant="geo">AI Bot Access</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              {/* Robots.txt */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">robots.txt</span>
                  {latestRun.site_signals?.robots_txt?.exists ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-semibold text-[11px]">
                      <CheckCircle2 size={13} /> Present
                    </span>
                  ) : (
                    <span className="text-rose-700 flex items-center gap-1 font-semibold text-[11px]">
                      <XCircle size={13} /> Missing
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-[11px]">
                  Sitemaps referenced: {latestRun.site_signals?.robots_txt?.sitemaps?.length || 0}
                </p>
              </div>

              {/* Sitemap.xml */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">XML Sitemap</span>
                  {latestRun.site_signals?.sitemap?.exists ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-semibold text-[11px]">
                      <CheckCircle2 size={13} /> Discovered
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-semibold text-[11px]">
                      <AlertCircle size={13} /> Missing
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-[11px]">
                  URLs discovered: {latestRun.site_signals?.sitemap?.url_count || 0}
                </p>
              </div>

              {/* llms.txt */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">llms.txt (AI Directives)</span>
                  {latestRun.site_signals?.llms_txt_exists ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-semibold text-[11px]">
                      <CheckCircle2 size={13} /> Present
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-semibold text-[11px]">
                      <AlertCircle size={13} /> Missing
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-[11px]">
                  Full context: {latestRun.site_signals?.llms_full_txt_exists ? 'Available' : 'None'}
                </p>
              </div>
            </div>

            {/* AI Crawlers Access */}
            {latestRun.site_signals?.robots_txt?.ai_crawlers && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-2.5">
                  AI Search Crawler Access (robots.txt permissions)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {latestRun.site_signals.robots_txt.ai_crawlers.map((bot) => (
                    <div
                      key={bot.crawler_name}
                      className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs flex items-center gap-2 shadow-2xs"
                    >
                      <span className="font-semibold text-slate-800">{bot.crawler_name}:</span>
                      <Badge
                        variant={
                          bot.status === 'blocked'
                            ? 'danger'
                            : bot.status === 'allowed'
                            ? 'success'
                            : 'neutral'
                        }
                        className="text-[10px] py-0"
                        dot
                      >
                        {bot.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── Issues Table with Accordion Expansion ───────────── */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Audit Findings & Recommendations
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredIssues.length} of {issues.length} detected issues
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                  {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSeverityFilter(sev)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                        severityFilter === sev
                          ? 'bg-white text-blue-700 font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 shadow-xs focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="technical">Technical</option>
                  <option value="on_page">On-Page</option>
                  <option value="indexability">Indexability</option>
                  <option value="content">Content</option>
                  <option value="links">Links</option>
                  <option value="structured_data">Structured Data</option>
                  <option value="security">Security</option>
                </select>
              </div>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No issues match your selected filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredIssues.map((issue) => {
                  const isExpanded = expandedIssueId === issue.id
                  return (
                    <div
                      key={issue.id}
                      className="py-3.5 space-y-2 transition-colors hover:bg-slate-50/50 rounded-lg px-2 -mx-2"
                    >
                      <div
                        className="flex items-start justify-between gap-3 cursor-pointer"
                        onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              issue.severity === 'critical' || issue.severity === 'high'
                                ? 'danger'
                                : issue.severity === 'medium'
                                ? 'warning'
                                : 'info'
                            }
                            className="text-[10px]"
                            dot
                          >
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="seo" className="text-[10px]">
                            {issue.category.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs font-bold text-slate-900">
                            {issue.issue}
                          </span>
                        </div>

                        <button className="text-slate-400 hover:text-slate-700 p-1">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {issue.affected_url && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1 font-mono">
                          <ExternalLink size={11} />
                          {issue.affected_url}
                        </p>
                      )}

                      {/* Expandable Evidence & Recommendation Details */}
                      {isExpanded && (
                        <div className="pt-2 space-y-2 text-xs animate-slide-down">
                          {issue.evidence && (
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                              <span className="font-semibold text-slate-900 block mb-0.5">
                                Concrete Evidence:
                              </span>
                              <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
                                {issue.evidence}
                              </p>
                            </div>
                          )}

                          <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-100 text-blue-950">
                            <span className="font-semibold block mb-0.5">
                              Remediation Recommendation:
                            </span>
                            <p className="text-blue-900 leading-relaxed">
                              {issue.recommendation}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ── Crawled Pages Table ──────────────────────────────── */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Crawled Pages Explorer
                </h3>
                <p className="text-xs text-slate-500">
                  {filteredPages.length} pages indexed in this crawl run
                </p>
              </div>

              <div className="w-full sm:w-72">
                <Input
                  id="page-search"
                  placeholder="Search URL or title..."
                  value={pageSearchQuery}
                  onChange={(e) => setPageSearchQuery(e.target.value)}
                  icon={<Search size={14} />}
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">URL</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">H1</th>
                    <th className="py-2.5 px-3">Words</th>
                    <th className="py-2.5 px-3">Schema</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPages.map((page) => (
                    <tr key={page.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 max-w-[220px] truncate font-mono text-slate-800">
                        {page.url}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                            page.status_code === 200
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {page.status_code || 'ERR'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-600">
                        {page.title || <span className="text-rose-500 italic">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3 max-w-[150px] truncate text-slate-600">
                        {page.h1 || <span className="text-amber-500 italic">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {page.word_count}
                      </td>
                      <td className="py-2.5 px-3">
                        {page.schema_data && page.schema_data.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {page.schema_data
                              .flatMap((s) => s.schema_types)
                              .slice(0, 2)
                              .map((t, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200/60"
                                >
                                  {t}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSelectedPage(page)}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Page Detail Modal / Drawer ────────────────────────── */}
      {selectedPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <Card className="max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in p-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Page Technical Inspector</h3>
                <p className="text-xs text-slate-400 font-mono truncate max-w-md mt-0.5">
                  {selectedPage.url}
                </p>
              </div>
              <button
                onClick={() => setSelectedPage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Status and speed */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <span className="text-slate-400 text-[11px]">HTTP Status</span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">
                    {selectedPage.status_code}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <span className="text-slate-400 text-[11px]">Response Time</span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">
                    {selectedPage.response_time_ms}ms
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <span className="text-slate-400 text-[11px]">Word Count</span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">
                    {selectedPage.word_count}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <span className="text-slate-400 text-[11px]">HTTPS</span>
                  <p className="font-bold text-sm text-emerald-600 mt-0.5">
                    {selectedPage.security_data?.is_https ? 'Secure' : 'Unencrypted'}
                  </p>
                </div>
              </div>

              {/* Title & Meta */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Title Tag</span>
                  <span className="text-slate-400 text-[11px]">{selectedPage.title_length || 0} chars</span>
                </div>
                <p className="text-slate-700">{selectedPage.title || 'Missing title'}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-900">Meta Description</span>
                  <span className="text-slate-400 text-[11px]">{selectedPage.meta_description_length || 0} chars</span>
                </div>
                <p className="text-slate-700">{selectedPage.meta_description || 'Missing description'}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-900">Canonical URL</span>
                </div>
                <p className="text-slate-600 font-mono text-[11px] truncate">
                  {selectedPage.canonical || 'None specified'}
                </p>
              </div>

              {/* Headings */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-white">
                <span className="font-bold text-slate-900">Headings Structure</span>
                <div>
                  <span className="font-semibold text-slate-700">H1: </span>
                  <span className="text-slate-600">{selectedPage.h1 || 'None'}</span>
                </div>
                {selectedPage.h2_data && selectedPage.h2_data.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-700">H2s ({selectedPage.h2_data.length}): </span>
                    <ul className="list-disc pl-4 mt-1 text-slate-600 space-y-0.5">
                      {selectedPage.h2_data.slice(0, 5).map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Links & Images */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <span className="font-bold text-slate-900">Links Profile</span>
                  <p className="mt-1 text-slate-600">Internal: {selectedPage.internal_links?.length || 0}</p>
                  <p className="text-slate-600">External: {selectedPage.external_links?.length || 0}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                  <span className="font-bold text-slate-900">Images</span>
                  <p className="mt-1 text-slate-600">Total: {selectedPage.image_count}</p>
                  <p className={selectedPage.missing_alt_count > 0 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                    Missing Alt: {selectedPage.missing_alt_count}
                  </p>
                </div>
              </div>

              {/* Schema Data */}
              {selectedPage.schema_data && selectedPage.schema_data.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-white">
                  <span className="font-bold text-slate-900">
                    Detected Structured Data (JSON-LD)
                  </span>
                  {selectedPage.schema_data.map((sd, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg font-mono text-[11px] border border-slate-100">
                      <p className="font-bold text-blue-700">Types: {sd.schema_types.join(', ') || 'Unknown'}</p>
                      {sd.error_message && <p className="text-rose-600 mt-1">{sd.error_message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedPage(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
