import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  Play,
  RotateCw,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Bot,
  Globe,
  Lightbulb,
  FlaskConical,
  Brain,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type { Project, ProjectListResponse, Report } from '@/types'

export default function ReportsPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [loadingReports, setLoadingReports] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 1. Load user projects
  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true)
      try {
        const res = await api.get<ProjectListResponse>('/api/v1/projects')
        const items = res.projects || []
        setProjects(items)
        const qpId = searchParams.get('projectId')
        if (qpId && items.some((p) => p.id === qpId)) {
          setSelectedProjectId(qpId)
        } else if (items.length > 0) {
          setSelectedProjectId(items[0].id)
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err?.message || 'Failed to load projects' })
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, [])

  // 2. Load reports for selected project
  useEffect(() => {
    if (!selectedProjectId) return
    loadReports(selectedProjectId)
  }, [selectedProjectId])

  const loadReports = async (projectId: string) => {
    setLoadingReports(true)
    setStatusMessage(null)
    try {
      const data = await api.get<Report[]>(`/api/v1/projects/${projectId}/reports`)
      setReports(data || [])
      if (data && data.length > 0) {
        setSelectedReport(data[0])
      } else {
        setSelectedReport(null)
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to load reports' })
    } finally {
      setLoadingReports(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!selectedProjectId || generatingReport) return
    setGeneratingReport(true)
    setStatusMessage(null)
    try {
      const res = await api.post<any>(`/api/v1/reports/generate?project_id=${selectedProjectId}`, {
        report_type: 'weekly_intelligence',
        period_days: 7,
      })
      setStatusMessage({
        type: 'success',
        text: res.message || 'Weekly intelligence report generated successfully.',
      })
      await loadReports(selectedProjectId)
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate report. Please try again.',
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <FileText className="text-[var(--color-primary-600)]" size={24} />
            Intelligence Reports
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Automated, evidence-driven weekly reporting across SEO, AI search visibility, competitor shifts, and learning.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value)
              setSearchParams({ projectId: e.target.value })
            }}
            className="text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            onClick={handleGenerateReport}
            disabled={generatingReport || !selectedProjectId}
            className="flex items-center gap-1.5"
          >
            {generatingReport ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                Compiling Report...
              </>
            ) : (
              <>
                <Play size={14} />
                Generate Report Now
              </>
            )}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success)]/20'
              : 'bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger)]/20'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold hover:opacity-75 ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Main Layout: Report List Sidebar + Detail View ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reports Archive List */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Report Archive ({reports.length})
          </h2>

          {loadingReports ? (
            <Card className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
              <RotateCw size={18} className="animate-spin mx-auto mb-2 text-[var(--color-primary-600)]" />
              Loading reports...
            </Card>
          ) : reports.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText size={32} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
              <p className="text-xs font-medium text-[var(--color-text-primary)]">No reports generated yet</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 mb-4">
                Weekly intelligence reports generate automatically on schedule, or you can trigger one now.
              </p>
              <Button size="sm" onClick={handleGenerateReport} disabled={generatingReport}>
                Generate First Report
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {reports.map((rep) => {
                const isSelected = selectedReport?.id === rep.id
                return (
                  <button
                    key={rep.id}
                    onClick={() => setSelectedReport(rep)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[var(--color-primary-50)] border-[var(--color-primary-400)] shadow-xs'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-tertiary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] capitalize">
                        {rep.report_type.replace('_', ' ')}
                      </span>
                      <Badge variant="neutral" className="text-[10px]">
                        {new Date(rep.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                      <Calendar size={12} />
                      <span>
                        {new Date(rep.period_start).toLocaleDateString()} – {new Date(rep.period_end).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] line-clamp-2 mt-2 leading-relaxed">
                      {rep.summary}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Report Detail View */}
        <div className="lg:col-span-8">
          {selectedReport ? (
            <div className="space-y-6">
              {/* Overview Header Card */}
              <Card className="p-6 border-t-4 border-t-[var(--color-primary-600)]">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[var(--color-text-primary)] capitalize">
                        {selectedReport.report_type.replace('_', ' ')} Report
                      </h2>
                      <Badge variant="seo">Verified Data</Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 flex items-center gap-2">
                      <Calendar size={13} />
                      Period: {new Date(selectedReport.period_start).toLocaleDateString()} to{' '}
                      {new Date(selectedReport.period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[var(--color-text-tertiary)]">
                    <p>Generated: {new Date(selectedReport.created_at).toLocaleString()}</p>
                    <p className="mt-0.5">Status: <span className="text-[var(--color-success)] font-medium">Completed</span></p>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="pt-4">
                  <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">
                    Executive Summary
                  </h3>
                  <p className="text-xs text-[var(--color-text-primary)] leading-relaxed bg-[var(--color-surface-secondary)] p-3 rounded-md border border-[var(--color-border)]">
                    {selectedReport.summary}
                  </p>
                </div>

                {/* Mandatory Data Freshness & Latency Notice */}
                <div className="mt-4 p-3 rounded-md bg-[var(--color-warning-light)] border border-[var(--color-warning)]/20 text-[11px] text-[var(--color-warning)] flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Search Console Data Freshness:</span> Google Search Console
                    reporting reflects a standard 48–72 hour data delay. AI search visibility metrics represent
                    real-time observed groundings across connected models.
                  </div>
                </div>
              </Card>

              {/* 1. SEO Performance Section */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-[var(--color-primary-600)]" size={18} />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Search Console (SEO) Performance
                  </h3>
                </div>

                {selectedReport.data.seo_performance ? (
                  <div className="space-y-4">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {selectedReport.data.seo_performance.summary}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Total Clicks</span>
                        <span className="text-base font-bold text-[var(--color-text-primary)]">
                          {(selectedReport.data.seo_performance.total_clicks || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Impressions</span>
                        <span className="text-base font-bold text-[var(--color-text-primary)]">
                          {(selectedReport.data.seo_performance.total_impressions || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Average CTR</span>
                        <span className="text-base font-bold text-[var(--color-text-primary)]">
                          {((selectedReport.data.seo_performance.average_ctr || 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Average Position</span>
                        <span className="text-base font-bold text-[var(--color-text-primary)]">
                          {(selectedReport.data.seo_performance.average_position || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Top Queries Table */}
                    {selectedReport.data.seo_performance.top_queries && selectedReport.data.seo_performance.top_queries.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-2">
                          Top Search Queries
                        </span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] text-[10px]">
                                <th className="pb-1.5 font-semibold">Query</th>
                                <th className="pb-1.5 font-semibold text-right">Clicks</th>
                                <th className="pb-1.5 font-semibold text-right">Impressions</th>
                                <th className="pb-1.5 font-semibold text-right">CTR</th>
                                <th className="pb-1.5 font-semibold text-right">Position</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {selectedReport.data.seo_performance.top_queries.slice(0, 5).map((q, idx) => (
                                <tr key={idx} className="hover:bg-[var(--color-surface-tertiary)]">
                                  <td className="py-2 text-[var(--color-text-primary)] font-medium max-w-[200px] truncate">{q.query}</td>
                                  <td className="py-2 text-right">{q.clicks}</td>
                                  <td className="py-2 text-right">{q.impressions.toLocaleString()}</td>
                                  <td className="py-2 text-right">{(q.ctr * 100).toFixed(1)}%</td>
                                  <td className="py-2 text-right font-medium">{q.position.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] italic">
                    Search Console metrics not yet connected or available for this period.
                  </p>
                )}
              </Card>

              {/* 2. GEO / AI Search Visibility Section */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="text-[var(--color-primary-600)]" size={18} />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    GEO / AI Search Visibility Observations
                  </h3>
                </div>

                {selectedReport.data.geo_visibility ? (
                  <div className="space-y-4">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {selectedReport.data.geo_visibility.summary}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Queries Tested</span>
                        <span className="text-base font-bold text-[var(--color-text-primary)]">
                          {selectedReport.data.geo_visibility.tested_queries_count || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Citations Observed</span>
                        <span className="text-base font-bold text-[var(--color-primary-600)]">
                          {selectedReport.data.geo_visibility.total_citations_observed || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-[var(--color-surface-secondary)] rounded-md border border-[var(--color-border)]">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">Brand Mentions</span>
                        <span className="text-base font-bold text-[var(--color-text-primary)]">
                          {selectedReport.data.geo_visibility.total_brand_mentions || 0}
                        </span>
                      </div>
                    </div>

                    {selectedReport.data.geo_visibility.citations && selectedReport.data.geo_visibility.citations.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-2">
                          Recent Observed Citations
                        </span>
                        <div className="space-y-1.5">
                          {selectedReport.data.geo_visibility.citations.map((c, i) => (
                            <div
                              key={i}
                              className="text-xs p-2.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] flex items-center justify-between"
                            >
                              <div className="truncate max-w-[70%]">
                                <span className="font-semibold text-[var(--color-text-primary)]">"{c.query}"</span>
                                <span className="text-[11px] text-[var(--color-text-tertiary)] block truncate mt-0.5">
                                  {c.cited_url || 'Website referenced'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="geo" className="capitalize text-[10px]">{c.provider}</Badge>
                                {c.brand_mentioned && <Badge variant="success" className="text-[10px]">Mention</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] italic">
                    No AI visibility groundings observed for this period.
                  </p>
                )}
              </Card>

              {/* 3. Competitor Intelligence Section */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="text-[var(--color-primary-600)]" size={18} />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Competitor Intelligence (Tavily Grounded)
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {selectedReport.data.competitor_insights?.summary ||
                    'Independent web groundings monitor competitors for comparison tables, FAQ schemas, and updated informational content.'}
                </p>
              </Card>

              {/* 4. Recommendations & Active Experiments Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recommendations */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="text-[var(--color-warning)]" size={16} />
                    <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                      Recommendations
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs mb-3">
                    <span>Total: <strong>{selectedReport.data.recommendations?.total_count || 0}</strong></span>
                    <span>Pending: <strong className="text-[var(--color-warning)]">{selectedReport.data.recommendations?.pending_count || 0}</strong></span>
                    <span>High Priority: <strong className="text-[var(--color-danger)]">{selectedReport.data.recommendations?.high_priority_count || 0}</strong></span>
                  </div>
                  <div className="space-y-2">
                    {(selectedReport.data.recommendations?.items || []).map((r: any) => (
                      <div key={r.id} className="p-2.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--color-text-primary)] truncate max-w-[80%]">{r.title}</span>
                          <Badge variant={r.priority === 'high' ? 'danger' : 'neutral'} className="text-[9px]">
                            {r.priority}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-1">{r.action}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Experiments */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FlaskConical className="text-[var(--color-primary-600)]" size={16} />
                    <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                      Experiments
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs mb-3">
                    <span>Active: <strong className="text-[var(--color-primary-600)]">{selectedReport.data.experiments?.active_count || 0}</strong></span>
                    <span>Completed: <strong>{selectedReport.data.experiments?.completed_count || 0}</strong></span>
                  </div>
                  <div className="space-y-2">
                    {(selectedReport.data.experiments?.items || []).map((exp: any) => (
                      <div key={exp.id} className="p-2.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--color-text-primary)] truncate max-w-[70%]">{exp.name}</span>
                          <Badge variant={exp.status === 'measuring' ? 'info' : 'neutral'} className="text-[9px]">
                            {exp.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 line-clamp-1">{exp.hypothesis}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* 5. What GEOlytics Learned (Hindsight Memory) */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="text-[var(--color-primary-600)]" size={18} />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    What GEOlytics Learned (Hindsight Long-Term Memory)
                  </h3>
                </div>

                {selectedReport.data.hindsight_learnings && selectedReport.data.hindsight_learnings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedReport.data.hindsight_learnings.map((mem, i) => (
                      <div key={i} className="p-3.5 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-xs">
                        <span className="font-semibold text-[var(--color-text-primary)] block mb-1">
                          {mem.title}
                        </span>
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                          {mem.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] italic">
                    No new Hindsight reflections synthesized for this period.
                  </p>
                )}
              </Card>

              {/* 6. Documented Limitations */}
              {selectedReport.data.limitations && selectedReport.data.limitations.length > 0 && (
                <div className="p-4 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-xs">
                  <span className="font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider block text-[10px] mb-2">
                    Methodological Limitations & Constraints
                  </span>
                  <ul className="space-y-1 text-[11px] text-[var(--color-text-secondary)] list-disc pl-4">
                    {selectedReport.data.limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Card className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
              Select a report from the archive to inspect its metrics and insights.
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
