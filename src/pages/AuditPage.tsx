import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
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
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { EmptyState, LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  AuditOverview,
  SEOIssue,
  CrawlPage,
} from '@/types'

export default function AuditPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

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

  // Active polling reference
  const pollTimerRef = useRef<number | null>(null)

  // 1. Fetch user projects
  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true)
      try {
        const res = await api.get<ProjectListResponse>('/api/v1/projects')
        setProjects(res.projects)
        const queryProjectId = searchParams.get('projectId')
        if (queryProjectId && res.projects.some((p) => p.id === queryProjectId)) {
          setSelectedProjectId(queryProjectId)
        } else if (res.projects.length > 0) {
          setSelectedProjectId(res.projects[0].id)
        }
      } catch (err) {
        console.error('Failed to load projects', err)
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      setSearchParams({ projectId: selectedProjectId })
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
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
              <Globe size={24} className="text-[var(--color-primary-600)]" />
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

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* ── Top Bar: Project selector & Run Audit CTA ─────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              Technical SEO & Crawl Intelligence
            </h1>
            <Badge variant="seo">Phase 2</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Diagnostic crawl analysis, technical health index, and GEO crawler signals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-sm border border-[var(--color-border)] rounded-md px-3 py-1.5 bg-white text-[var(--color-text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.website_url})
              </option>
            ))}
          </select>

          <Button
            size="sm"
            onClick={handleRunAudit}
            loading={triggeringCrawl || isCrawlActive}
            disabled={isCrawlActive}
          >
            {isCrawlActive ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                {latestRun?.status === 'crawling' ? 'Crawling Pages...' : 'Analyzing SEO...'}
              </>
            ) : (
              <>
                <Play size={14} /> Run SEO Audit
              </>
            )}
          </Button>
        </div>
      </div>

      {crawlError && (
        <div className="p-3 rounded-md bg-[var(--color-danger-light)] text-[var(--color-danger)] text-sm flex items-center justify-between">
          <span>{crawlError}</span>
          <button onClick={() => setCrawlError('')} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Active Crawl Progress Banner ─────────────────────── */}
      {isCrawlActive && (
        <div className="p-4 rounded-lg bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <RotateCw size={18} className="animate-spin text-[var(--color-primary-600)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-primary-900)]">
                Audit in progress for {currentProject?.website_url}
              </p>
              <p className="text-xs text-[var(--color-primary-700)]">
                Status: {latestRun?.status?.toUpperCase()} · Safely inspecting pages, robots.txt, and schema signals...
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-[var(--color-primary-700)]">
            Auto-refreshing
          </span>
        </div>
      )}

      {/* ── Empty State: No Crawl Runs Yet ──────────────────── */}
      {!loadingAudit && !latestRun && (
        <Card className="py-12">
          <EmptyState
            icon={
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
                <Wrench size={28} className="text-[var(--color-primary-600)]" />
              </div>
            }
            title="No SEO audit yet"
            description={`Run your first automated crawl and technical audit for ${currentProject?.website_url}. Our safe crawler will discover on-page issues, schema markup, and AI bot directives.`}
            action={
              <Button size="sm" onClick={handleRunAudit} loading={triggeringCrawl}>
                <Play size={14} /> Run your first audit
              </Button>
            }
          />
        </Card>
      )}

      {/* ── Failed State ────────────────────────────────────── */}
      {latestRun && latestRun.status === 'failed' && (
        <Card className="border-[var(--color-danger-border)] bg-[var(--color-danger-light)]">
          <div className="flex items-start gap-4">
            <XCircle size={24} className="text-[var(--color-danger)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[var(--color-danger)]">
                Crawl & Audit Failed
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Reason: {latestRun.error || 'The crawler encountered an unhandled network error.'}
              </p>
              <div className="mt-4">
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
          {/* Diagnostic SEO Health Index + Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Health Index Card */}
            <Card className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Diagnostic Index
                  </span>
                  <Badge variant="seo">SEO Health</Badge>
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-bold text-[var(--color-text-primary)]">
                    {latestRun.seo_health_score ?? '--'}
                  </span>
                  <span className="text-sm text-[var(--color-text-tertiary)]">/ 100</span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                  Informational diagnostic score. <strong>Not</strong> an official Google ranking score or probability.
                </p>
              </div>

              {/* Category Breakdown Bars */}
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
                {Object.entries(latestRun.category_scores || {}).map(([cat, score]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)] capitalize">
                      {cat.replace('_', ' ')}
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Crawl Summary Card */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Crawl Coverage
                </span>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                      {latestRun.pages_crawled}
                    </span>
                    <p className="text-xs text-[var(--color-text-secondary)]">Pages Crawled</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-[var(--color-danger)]">
                      {latestRun.pages_failed}
                    </span>
                    <p className="text-xs text-[var(--color-text-secondary)]">Pages Failed</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
                  Completed on {new Date(latestRun.completed_at || latestRun.created_at).toLocaleString()}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Same-domain, safe SSRF-guarded crawl within depth limit 3.
                </span>
              </div>
            </Card>

            {/* Issues Tally Card */}
            <Card className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Detected Issues
                </span>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-bold text-[var(--color-text-primary)]">
                    {overview?.total_issues ?? 0}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">total findings</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-danger)]" />
                    <span className="text-[var(--color-text-secondary)]">Critical:</span>
                    <span className="font-bold">{overview?.critical_issues ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
                    <span className="text-[var(--color-text-secondary)]">High:</span>
                    <span className="font-bold">{overview?.high_issues ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[var(--color-text-secondary)]">Medium:</span>
                    <span className="font-bold">{overview?.medium_issues ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[var(--color-text-secondary)]">Low:</span>
                    <span className="font-bold">{overview?.low_issues ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Every issue includes concrete evidence & remediation advice.
                </span>
              </div>
            </Card>
          </div>

          {/* ── GEO Technical Signals & Robots.txt Section ────────── */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-[var(--color-geo)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  GEO Technical Signals & Crawler Directives
                </h3>
              </div>
              <Badge variant="geo">GEO Signals</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Robots.txt */}
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text-primary)]">robots.txt</span>
                  {latestRun.site_signals?.robots_txt?.exists ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} /> Present
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 font-medium">
                      <XCircle size={13} /> Missing
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-text-tertiary)]">
                  Sitemaps referenced: {latestRun.site_signals?.robots_txt?.sitemaps?.length || 0}
                </p>
              </div>

              {/* Sitemap.xml */}
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text-primary)]">XML Sitemap</span>
                  {latestRun.site_signals?.sitemap?.exists ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} /> Discovered
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} /> Missing
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-text-tertiary)]">
                  URLs discovered: {latestRun.site_signals?.sitemap?.url_count || 0}
                </p>
              </div>

              {/* llms.txt */}
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text-primary)]">llms.txt (AI Context)</span>
                  {latestRun.site_signals?.llms_txt_exists ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={13} /> Present
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} /> Not Configured
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-text-tertiary)]">
                  Full context: {latestRun.site_signals?.llms_full_txt_exists ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* AI Crawlers Access Table */}
            {latestRun.site_signals?.robots_txt?.ai_crawlers && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">
                  AI Search Crawler Access (robots.txt directives)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {latestRun.site_signals.robots_txt.ai_crawlers.map((bot) => (
                    <div
                      key={bot.crawler_name}
                      className="px-2.5 py-1 rounded border border-[var(--color-border)] bg-white text-xs flex items-center gap-1.5"
                    >
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {bot.crawler_name}:
                      </span>
                      <span
                        className={
                          bot.status === 'blocked'
                            ? 'text-rose-600 font-semibold'
                            : bot.status === 'allowed'
                            ? 'text-emerald-600 font-semibold'
                            : 'text-slate-600 font-medium'
                        }
                      >
                        {bot.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── Issues Table Section ─────────────────────────────── */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Audit Findings & Recommendations
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Showing {filteredIssues.length} of {issues.length} detected issues
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white text-[var(--color-text-secondary)]"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-white text-[var(--color-text-secondary)]"
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
              <div className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                No issues match your selected filters.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {filteredIssues.map((issue) => (
                  <div key={issue.id} className="py-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          issue.severity === 'critical' || issue.severity === 'high'
                            ? 'danger'
                            : issue.severity === 'medium'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {issue.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="seo">{issue.category.replace('_', ' ')}</Badge>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {issue.issue}
                      </span>
                    </div>

                    {issue.affected_url && (
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate flex items-center gap-1 font-mono">
                        <ExternalLink size={10} />
                        {issue.affected_url}
                      </p>
                    )}

                    {issue.evidence && (
                      <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] p-2 rounded border border-[var(--color-border-subtle)]">
                        <span className="font-semibold text-[var(--color-text-primary)]">Evidence: </span>
                        {issue.evidence}
                      </p>
                    )}

                    <p className="text-xs text-blue-900 bg-blue-50 p-2 rounded border border-blue-100">
                      <span className="font-semibold">Recommendation: </span>
                      {issue.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Crawled Pages Table ──────────────────────────────── */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Crawled Pages Explorer
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {filteredPages.length} pages indexed in this crawl run
                </p>
              </div>

              <div className="w-full sm:w-64">
                <Input
                  id="page-search"
                  placeholder="Search by URL or title..."
                  value={pageSearchQuery}
                  onChange={(e) => setPageSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">URL</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Title</th>
                    <th className="py-2.5 px-3 font-semibold">H1</th>
                    <th className="py-2.5 px-3 font-semibold">Words</th>
                    <th className="py-2.5 px-3 font-semibold">Schema</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-white">
                  {filteredPages.map((page) => (
                    <tr key={page.id} className="hover:bg-[var(--color-surface-secondary)]">
                      <td className="py-2.5 px-3 max-w-[220px] truncate font-mono text-[var(--color-text-primary)]">
                        {page.url}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                            page.status_code === 200
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {page.status_code || 'ERR'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate text-[var(--color-text-secondary)]">
                        {page.title || <span className="text-rose-500 italic">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3 max-w-[150px] truncate text-[var(--color-text-secondary)]">
                        {page.h1 || <span className="text-amber-500 italic">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">
                        {page.word_count}
                      </td>
                      <td className="py-2.5 px-3">
                        {page.schema_data && page.schema_data.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {page.schema_data.flatMap((s) => s.schema_types).slice(0, 2).map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedPage(page)}
                        >
                          Details
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-[var(--color-border)]">
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-secondary)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Page Detail Inspector
                </h3>
                <p className="text-xs text-[var(--color-text-tertiary)] truncate max-w-md font-mono">
                  {selectedPage.url}
                </p>
              </div>
              <button
                onClick={() => setSelectedPage(null)}
                className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-border)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Status and speed */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">Status</span>
                  <p className="font-bold text-sm text-[var(--color-text-primary)]">
                    {selectedPage.status_code}
                  </p>
                </div>
                <div className="p-2.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">Response Time</span>
                  <p className="font-bold text-sm text-[var(--color-text-primary)]">
                    {selectedPage.response_time_ms}ms
                  </p>
                </div>
                <div className="p-2.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">Word Count</span>
                  <p className="font-bold text-sm text-[var(--color-text-primary)]">
                    {selectedPage.word_count}
                  </p>
                </div>
                <div className="p-2.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">HTTPS</span>
                  <p className="font-bold text-sm text-emerald-600">
                    {selectedPage.security_data?.is_https ? 'Secure' : 'No'}
                  </p>
                </div>
              </div>

              {/* Title & Meta */}
              <div className="space-y-2 border border-[var(--color-border)] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text-primary)]">Title Tag</span>
                  <span className="text-[var(--color-text-tertiary)]">{selectedPage.title_length || 0} chars</span>
                </div>
                <p className="text-[var(--color-text-secondary)]">{selectedPage.title || 'Missing'}</p>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
                  <span className="font-semibold text-[var(--color-text-primary)]">Meta Description</span>
                  <span className="text-[var(--color-text-tertiary)]">{selectedPage.meta_description_length || 0} chars</span>
                </div>
                <p className="text-[var(--color-text-secondary)]">{selectedPage.meta_description || 'Missing'}</p>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
                  <span className="font-semibold text-[var(--color-text-primary)]">Canonical URL</span>
                </div>
                <p className="text-[var(--color-text-secondary)] font-mono truncate">{selectedPage.canonical || 'None specified'}</p>
              </div>

              {/* Headings */}
              <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
                <span className="font-semibold text-[var(--color-text-primary)]">Headings</span>
                <div>
                  <span className="font-medium text-[var(--color-text-secondary)]">H1: </span>
                  <span>{selectedPage.h1 || 'None'}</span>
                </div>
                {selectedPage.h2_data && selectedPage.h2_data.length > 0 && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">H2s ({selectedPage.h2_data.length}): </span>
                    <ul className="list-disc pl-4 mt-1 text-[var(--color-text-secondary)] space-y-0.5">
                      {selectedPage.h2_data.slice(0, 5).map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Links & Images */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-[var(--color-border)] rounded-lg p-3">
                  <span className="font-semibold text-[var(--color-text-primary)]">Links</span>
                  <p className="mt-1">Internal: {selectedPage.internal_links?.length || 0}</p>
                  <p>External: {selectedPage.external_links?.length || 0}</p>
                </div>
                <div className="border border-[var(--color-border)] rounded-lg p-3">
                  <span className="font-semibold text-[var(--color-text-primary)]">Images</span>
                  <p className="mt-1">Total: {selectedPage.image_count}</p>
                  <p className={selectedPage.missing_alt_count > 0 ? 'text-amber-600 font-semibold' : ''}>
                    Missing Alt: {selectedPage.missing_alt_count}
                  </p>
                </div>
              </div>

              {/* Schema Data */}
              {selectedPage.schema_data && selectedPage.schema_data.length > 0 && (
                <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Detected Structured Data (JSON-LD)
                  </span>
                  {selectedPage.schema_data.map((sd, i) => (
                    <div key={i} className="p-2 bg-[var(--color-surface-secondary)] rounded font-mono text-[11px]">
                      <p className="font-bold text-blue-800">Types: {sd.schema_types.join(', ') || 'Unknown'}</p>
                      {sd.error_message && <p className="text-rose-600 mt-1">{sd.error_message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)] flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setSelectedPage(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
