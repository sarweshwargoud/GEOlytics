import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  RotateCw,
  Sliders,
  Lightbulb,
  FlaskConical,
  Bot,
  FileText,
  Activity,
  X,
  Clock,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  NotificationItem,
  NotificationPreferences,
  NotificationCategory,
} from '@/types'

export default function NotificationsPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Preferences modal
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
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

  // 2. Load notifications and preferences
  useEffect(() => {
    if (!selectedProjectId) return
    loadNotifications(selectedProjectId)
    loadPreferences(selectedProjectId)
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotifications = async (projectId: string) => {
    setLoadingNotifs(true)
    try {
      const data = await api.get<NotificationItem[]>(`/api/v1/projects/${projectId}/notifications`)
      setNotifications(data || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoadingNotifs(false)
    }
  }

  const loadPreferences = async (projectId: string) => {
    try {
      const prefs = await api.get<NotificationPreferences>(`/api/v1/projects/${projectId}/notifications/preferences`)
      setPreferences(prefs)
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await api.post(`/api/v1/notifications/${notifId}/read`, {})
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      )
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    if (!selectedProjectId) return
    try {
      await api.post(`/api/v1/projects/${selectedProjectId}/notifications/read-all`, {})
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setStatusMessage({ type: 'success', text: 'All alerts marked as read.' })
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to mark all as read.' })
    }
  }

  const handleSavePreferences = async () => {
    if (!selectedProjectId || !preferences) return
    setSavingPrefs(true)
    setStatusMessage(null)
    try {
      const updated = await api.patch<NotificationPreferences>(
        `/api/v1/projects/${selectedProjectId}/notifications/preferences`,
        preferences
      )
      setPreferences(updated)
      setShowPreferences(false)
      setStatusMessage({ type: 'success', text: 'Notification preferences updated.' })
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to save preferences.' })
    } finally {
      setSavingPrefs(false)
    }
  }

  const getCategoryIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'recommendation':
        return <Lightbulb size={16} className="text-amber-600" />
      case 'experiment':
        return <FlaskConical size={16} className="text-blue-600" />
      case 'geo_change':
        return <Bot size={16} className="text-purple-600" />
      case 'report':
        return <FileText size={16} className="text-indigo-600" />
      case 'system':
      default:
        return <Activity size={16} className="text-slate-600" />
    }
  }

  const filteredNotifs = notifications.filter(
    (n) => filterCategory === 'all' || n.category === filterCategory
  )
  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Alerts & Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Real-time feed of automated crawl alerts, recommendation proposals, and completed measurements.
          </p>
        </div>

        {/* Action Controls */}
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
            variant="secondary"
            size="xs"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1"
          >
            <CheckCheck size={13} /> Mark all read
          </Button>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => setShowPreferences(true)}
            className="flex items-center gap-1"
          >
            <Sliders size={13} /> Preferences
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
          <button onClick={() => setStatusMessage(null)} className="font-bold hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* ── Category Filters ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs">
        {[
          { id: 'all', label: 'All' },
          { id: 'recommendation', label: 'Recommendations' },
          { id: 'experiment', label: 'Experiments' },
          { id: 'geo_change', label: 'GEO / AI Search' },
          { id: 'report', label: 'Reports' },
          { id: 'system', label: 'System' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilterCategory(item.id)}
            className={`px-3 py-1.5 rounded-md capitalize transition-all font-medium ${
              filterCategory === item.id
                ? 'bg-white text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Notifications Feed ──────────────────────────────── */}
      {loadingNotifs ? (
        <Card className="p-8 text-center text-xs text-slate-400">
          <RotateCw size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
          Loading notifications...
        </Card>
      ) : filteredNotifs.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-slate-300">
          <Bell size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-900">No alerts in this category</p>
          <p className="text-[11px] text-slate-500 mt-1">
            New alerts will appear here as your automated workflows and intelligence jobs run.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifs.map((n) => {
            const isUnread = !n.is_read
            return (
              <Card
                key={n.id}
                hoverLift
                className={`p-4 transition-all ${
                  isUnread
                    ? 'border-l-4 border-l-blue-600 bg-white shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-xl bg-slate-100 shrink-0 mt-0.5">
                      {getCategoryIcon(n.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {n.title}
                        </span>
                        <Badge variant="neutral" className="text-[9px] uppercase">
                          {n.category}
                        </Badge>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-100" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 font-mono">
                        <Clock size={11} />
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleMarkAsRead(n.id)}
                      className="shrink-0 text-slate-400 hover:text-slate-700"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Preferences Modal ───────────────────────────────── */}
      {showPreferences && preferences && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Notification Preferences</h2>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Customize which alerts trigger in-app updates and external notifications for this project.
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span className="font-semibold text-slate-800 block">High Priority Recommendations</span>
                  <span className="text-[11px] text-slate-400">Alert on new opportunities from LangGraph</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.high_priority_recs}
                  onChange={(e) =>
                    setPreferences({ ...preferences, high_priority_recs: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span className="font-semibold text-slate-800 block">Experiment Measurements</span>
                  <span className="text-[11px] text-slate-400">Notify when before/after deltas are evaluated</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.experiment_results}
                  onChange={(e) =>
                    setPreferences({ ...preferences, experiment_results: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span className="font-semibold text-slate-800 block">GEO / AI Search Citations</span>
                  <span className="text-[11px] text-slate-400">Alert on new AI engine mentions and citations</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.geo_visibility_changes}
                  onChange={(e) =>
                    setPreferences({ ...preferences, geo_visibility_changes: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span className="font-semibold text-slate-800 block">Weekly Intelligence Digest</span>
                  <span className="text-[11px] text-slate-400">Notify when scheduled report is ready</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.weekly_reports}
                  onChange={(e) =>
                    setPreferences({ ...preferences, weekly_reports: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span className="font-semibold text-slate-800 block">Automation Failures</span>
                  <span className="text-[11px] text-slate-400">Alert if recurring jobs encounter issues</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.automation_failures}
                  onChange={(e) =>
                    setPreferences({ ...preferences, automation_failures: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="font-semibold text-slate-800 block">Email Notifications</span>
                  <span className="text-[11px] text-slate-400">Send digests to registered account email</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.email_notifications_enabled}
                  onChange={(e) =>
                    setPreferences({ ...preferences, email_notifications_enabled: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingPrefs}
                onClick={handleSavePreferences}
              >
                Save Preferences
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
