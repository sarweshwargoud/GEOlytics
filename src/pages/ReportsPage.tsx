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
  Copy,
  Check,
  Printer,
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
  const [copied, setCopied] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 1. Load user projects
  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true)
      try {
        const res = await api.get<ProjectListResponse>('/api/v1/projects')
        const items = res.projects || []
        setProjects(items)
        const qpId = searchParams.get('projectId') || searchParams.get('project')
        if (qpId && items.some((p) => p.id === qpId)) {
          setSelectedProjectId(qpId)
        } else if (items.length > 0) {
          setSelectedProjectId(items[0].id)
        }
      } catch (err: unknown) {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to load projects',
        })
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Load reports for selected project
  useEffect(() => {
    if (!selectedProjectId) return
    loadReports(selectedProjectId)
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load reports',
      })
    } finally {
      setLoadingReports(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!selectedProjectId || generatingReport) return
    setGeneratingReport(true)
    setStatusMessage(null)
    try {
      const res = await api.post<{ message?: string }>(
        `/api/v1/reports/generate?project_id=${selectedProjectId}`,
        {
          report_type: 'weekly_intelligence',
          period_days: 7,
        }
      )
      setStatusMessage({
        type: 'success',
        text: res.message || 'Weekly intelligence report generated successfully.',
      })
      await loadReports(selectedProjectId)
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate report. Please try again.',
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleCopySummary = () => {
    if (!selectedReport) return
    navigator.clipboard.writeText(
      `GEOlytics ${selectedReport.report_type.replace(/_/g, ' ').toUpperCase()} REPORT (${new Date(selectedReport.period_start).toLocaleDateString()} - ${new Date(selectedReport.period_end).toLocaleDateString()}):\n\n${selectedReport.summary}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Intelligence Reports
            </h1>
            <Badge variant="seo">Automated Digest</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Evidence-driven weekly synthesis across SEO performance, AI search citations, competitor insights, and verified learning.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {projects.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Project:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value)
                  setSearchParams({ project: e.target.value })
                }}
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
            size="sm"
            onClick={handleGenerateReport}
            disabled={generatingReport || !selectedProjectId}
            className="flex items-center gap-1.5"
          >
            {generatingReport ? (
              <>
                <RotateCw size={13} className="animate-spin" />
                Compiling Report...
              </>
            ) : (
              <>
                <Play size={13} />
                Generate Report Now
              </>
            )}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between animate-scale-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold hover:opacity-75 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main Layout: Report List Sidebar + Detail View ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reports Archive List */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} className="text-blue-600" />
            Report Archive ({reports.length})
          </h2>

          {loadingReports ? (
            <Card className="p-6 text-center text-xs text-slate-400">
              <RotateCw size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
              Loading report archive...
            </Card>
          ) : reports.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-slate-300">
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-900">No reports generated yet</p>
              <p className="text-[11px] text-slate-500 mt-1 mb-4 leading-relaxed">
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
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 capitalize">
                        {rep.report_type.replace(/_/g, ' ')}
                      </span>
                      <Badge variant="neutral" className="text-[10px]">
                        {new Date(rep.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                      <Calendar size={12} className="text-slate-400" />
                      <span>
                        {new Date(rep.period_start).toLocaleDateString()} –{' '}
                        {new Date(rep.period_end).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-2 leading-relaxed">
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
              <Card hoverLift className="p-6 border-t-4 border-t-blue-600">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 capitalize">
                        {selectedReport.report_type.replace(/_/g, ' ')} Digest
                      </h2>
                      <Badge variant="seo">Verified Telemetry</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      Period: {new Date(selectedReport.period_start).toLocaleDateString()} to{' '}
                      {new Date(selectedReport.period_end).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={handleCopySummary}
                      title="Copy summary text"
                    >
                      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => window.print()}
                      title="Print or Save as PDF"
                    >
                      <Printer size={12} /> Print
                    </Button>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="pt-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Executive Summary
                  </h3>
                  <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    {selectedReport.summary}
                  </div>
                </div>

                {/* Mandatory Data Freshness & Latency Notice */}
                <div className="mt-4 p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Search Console Data Freshness: </span>
                    Google Search Console telemetry reflects standard 48–72h official API latency. AI search visibility metrics represent observable search-grounded citations across configured engines.
                  </div>
                </div>
              </Card>

              {/* 1. SEO Performance Section */}
              <Card hoverLift className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-blue-600" size={18} />
                  <h3 className="text-sm font-bold text-slate-900">
                    Search Console (SEO) Performance
                  </h3>
                </div>

                {selectedReport.data.seo_performance ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600">
                      {selectedReport.data.seo_performance.summary}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Clicks</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {(selectedReport.data.seo_performance.total_clicks || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Impressions</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {(selectedReport.data.seo_performance.total_impressions || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Average CTR</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {((selectedReport.data.seo_performance.average_ctr || 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Average Position</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {(selectedReport.data.seo_performance.average_position || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Top Queries Table */}
                    {selectedReport.data.seo_performance.top_queries &&
                      selectedReport.data.seo_performance.top_queries.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs font-bold text-slate-700 block mb-2">
                            Top Search Queries
                          </span>
                          <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                                <tr>
                                  <th className="py-2 px-3">Query</th>
                                  <th className="py-2 px-3 text-right">Clicks</th>
                                  <th className="py-2 px-3 text-right">Impressions</th>
                                  <th className="py-2 px-3 text-right">CTR</th>
                                  <th className="py-2 px-3 text-right">Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {selectedReport.data.seo_performance.top_queries.slice(0, 5).map((q, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/80">
                                    <td className="py-2 px-3 text-slate-900 font-semibold max-w-[200px] truncate">
                                      {q.query}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-blue-600">
                                      {q.clicks}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600">
                                      {q.impressions.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600">
                                      {(q.ctr * 100).toFixed(1)}%
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-medium">
                                      {q.position.toFixed(1)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Search Console metrics not yet connected or available for this period.
                  </p>
                )}
              </Card>

              {/* 2. GEO / AI Search Visibility Section */}
              <Card hoverLift className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="text-purple-600" size={18} />
                  <h3 className="text-sm font-bold text-slate-900">
                    GEO / AI Search Visibility Observations
                  </h3>
                </div>

                {selectedReport.data.geo_visibility ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600">
                      {selectedReport.data.geo_visibility.summary}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Queries Tested</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {selectedReport.data.geo_visibility.tested_queries_count || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Citations Observed</span>
                        <span className="text-base font-extrabold text-purple-600">
                          {selectedReport.data.geo_visibility.total_citations_observed || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Brand Mentions</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {selectedReport.data.geo_visibility.total_brand_mentions || 0}
                        </span>
                      </div>
                    </div>

                    {selectedReport.data.geo_visibility.citations &&
                      selectedReport.data.geo_visibility.citations.length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs font-bold text-slate-700 block mb-2">
                            Recent Observed Citations
                          </span>
                          <div className="space-y-1.5">
                            {selectedReport.data.geo_visibility.citations.map((c, i) => (
                              <div
                                key={i}
                                className="text-xs p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                              >
                                <div className="truncate max-w-[70%]">
                                  <span className="font-semibold text-slate-900">"{c.query}"</span>
                                  <span className="text-[11px] text-slate-400 block truncate mt-0.5 font-mono">
                                    {c.cited_url || 'Website referenced'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="geo" className="capitalize text-[10px]">
                                    {c.provider}
                                  </Badge>
                                  {c.brand_mentioned && (
                                    <Badge variant="success" className="text-[10px]" dot>
                                      Mention
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No AI visibility groundings observed for this period.
                  </p>
                )}
              </Card>

              {/* 3. Competitor Intelligence Section */}
              <Card hoverLift className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="text-blue-600" size={18} />
                  <h3 className="text-sm font-bold text-slate-900">
                    Competitor Intelligence (Tavily Grounded)
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedReport.data.competitor_insights?.summary ||
                    'Independent web groundings monitor competitors for comparison tables, FAQ schemas, and updated informational content.'}
                </p>
              </Card>

              {/* 4. Recommendations & Active Experiments Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recommendations */}
                <Card hoverLift className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="text-amber-600" size={16} />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Recommendations
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs mb-3 text-slate-600">
                    <span>
                      Total: <strong>{selectedReport.data.recommendations?.total_count || 0}</strong>
                    </span>
                    <span>
                      Pending:{' '}
                      <strong className="text-amber-600">
                        {selectedReport.data.recommendations?.pending_count || 0}
                      </strong>
                    </span>
                    <span>
                      High Priority:{' '}
                      <strong className="text-rose-600">
                        {selectedReport.data.recommendations?.high_priority_count || 0}
                      </strong>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(selectedReport.data.recommendations?.items || []).map((r: any) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 truncate max-w-[80%]">
                            {r.title}
                          </span>
                          <Badge
                            variant={r.priority === 'high' ? 'danger' : 'neutral'}
                            className="text-[9px]"
                          >
                            {r.priority}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{r.action}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Experiments */}
                <Card hoverLift className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FlaskConical className="text-blue-600" size={16} />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Experiments
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs mb-3 text-slate-600">
                    <span>
                      Active:{' '}
                      <strong className="text-blue-600">
                        {selectedReport.data.experiments?.active_count || 0}
                      </strong>
                    </span>
                    <span>
                      Completed:{' '}
                      <strong>
                        {selectedReport.data.experiments?.completed_count || 0}
                      </strong>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(selectedReport.data.experiments?.items || []).map((exp: any) => (
                      <div
                        key={exp.id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 truncate max-w-[70%]">
                            {exp.name}
                          </span>
                          <Badge
                            variant={exp.status === 'measuring' ? 'info' : 'neutral'}
                            className="text-[9px]"
                            dot
                          >
                            {exp.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {exp.hypothesis}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* 5. What GEOlytics Learned (Hindsight Memory) */}
              <Card hoverLift className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="text-purple-600" size={18} />
                  <h3 className="text-sm font-bold text-slate-900">
                    What GEOlytics Learned (Hindsight Long-Term Memory)
                  </h3>
                </div>

                {selectedReport.data.hindsight_learnings &&
                selectedReport.data.hindsight_learnings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedReport.data.hindsight_learnings.map((mem, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                      >
                        <span className="font-bold text-slate-900 block">
                          {mem.title}
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {mem.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No new Hindsight reflections synthesized for this period.
                  </p>
                )}
              </Card>

              {/* 6. Documented Limitations */}
              {selectedReport.data.limitations && selectedReport.data.limitations.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px] mb-2">
                    Methodological Limitations & Constraints
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4">
                    {selectedReport.data.limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Card className="p-12 text-center text-xs text-slate-400">
              Select a report from the archive to inspect its metrics and insights.
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
