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

  // 2. Load notifications and preferences
  useEffect(() => {
    if (!selectedProjectId) return
    loadNotifications(selectedProjectId)
    loadPreferences(selectedProjectId)
  }, [selectedProjectId])

  const loadNotifications = async (projectId: string) => {
    setLoadingNotifs(true)
    try {
      const data = await api.get<NotificationItem[]>(`/api/v1/projects/${projectId}/notifications`)
      setNotifications(data || [])
    } catch (err: any) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoadingNotifs(false)
    }
  }

  const loadPreferences = async (projectId: string) => {
    try {
      const prefs = await api.get<NotificationPreferences>(`/api/v1/projects/${projectId}/notifications/preferences`)
      setPreferences(prefs)
    } catch (err: any) {
      console.error('Failed to load preferences:', err)
    }
  }

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await api.post(`/api/v1/notifications/${notifId}/read`, {})
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      )
    } catch (err: any) {
      console.error('Failed to mark read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    if (!selectedProjectId) return
    try {
      await api.post(`/api/v1/projects/${selectedProjectId}/notifications/read-all`, {})
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setStatusMessage({ type: 'success', text: 'All notifications marked as read.' })
    } catch (err: any) {
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
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to save preferences.' })
    } finally {
      setSavingPrefs(false)
    }
  }

  const getCategoryIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'recommendation':
        return <Lightbulb size={16} className="text-[var(--color-warning)]" />
      case 'experiment':
        return <FlaskConical size={16} className="text-[var(--color-primary-600)]" />
      case 'geo_change':
        return <Bot size={16} className="text-[var(--color-primary-600)]" />
      case 'report':
        return <FileText size={16} className="text-[var(--color-primary-600)]" />
      case 'system':
      default:
        return <Activity size={16} className="text-[var(--color-text-secondary)]" />
    }
  }

  const filteredNotifs = notifications.filter((n) => {
    if (filterCategory === 'all') return true
    if (filterCategory === 'unread') return !n.is_read
    return n.category === filterCategory
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Bell className="text-[var(--color-primary-600)]" size={24} />
            Notifications & Intelligence Alerts
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Real-time updates on high-priority opportunities, experiment outcomes, and scheduled reports.
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
            variant="outline"
            onClick={() => setShowPreferences(true)}
            className="flex items-center gap-1.5"
          >
            <Sliders size={14} />
            Preferences
          </Button>

          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5"
            >
              <CheckCheck size={14} />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-md text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success)]/20'
              : 'bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[var(--color-danger)]/20'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* ── Category Filters ─────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
            filterCategory === 'all'
              ? 'bg-[var(--color-primary-600)] text-white'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setFilterCategory('unread')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
            filterCategory === 'unread'
              ? 'bg-[var(--color-primary-600)] text-white'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
          }`}
        >
          Unread ({unreadCount})
        </button>

        <button
          onClick={() => setFilterCategory('recommendation')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
            filterCategory === 'recommendation'
              ? 'bg-[var(--color-primary-600)] text-white'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
          }`}
        >
          Recommendations
        </button>

        <button
          onClick={() => setFilterCategory('experiment')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
            filterCategory === 'experiment'
              ? 'bg-[var(--color-primary-600)] text-white'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
          }`}
        >
          Experiments
        </button>

        <button
          onClick={() => setFilterCategory('report')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
            filterCategory === 'report'
              ? 'bg-[var(--color-primary-600)] text-white'
              : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
          }`}
        >
          Reports
        </button>
      </div>

      {/* ── Notification Feed ────────────────────────────────── */}
      {loadingNotifs ? (
        <Card className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
          <RotateCw size={18} className="animate-spin mx-auto mb-2 text-[var(--color-primary-600)]" />
          Loading notifications...
        </Card>
      ) : filteredNotifs.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell size={32} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
          <p className="text-xs font-medium text-[var(--color-text-primary)]">No notifications found</p>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            You're all caught up! New alerts will appear here when automated jobs complete.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifs.map((item) => (
            <Card
              key={item.id}
              className={`p-4 transition-all border ${
                !item.is_read
                  ? 'bg-[var(--color-surface)] border-l-4 border-l-[var(--color-primary-600)] shadow-xs'
                  : 'bg-[var(--color-surface-secondary)] border-[var(--color-border)] opacity-85'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-surface-tertiary)] shrink-0">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {item.title}
                      </span>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-primary-600)] shrink-0" />
                      )}
                      <Badge variant="neutral" className="text-[9px] capitalize">
                        {item.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {!item.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(item.id)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-600)] p-1.5 rounded transition-colors"
                    title="Mark as read"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Notification Preferences Modal ──────────────────── */}
      {showPreferences && preferences && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Sliders size={16} className="text-[var(--color-primary-600)]" />
                Notification Preferences
              </h2>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              Choose which events trigger notification updates for this project:
            </p>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    High-Priority Recommendations
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Notify when critical SEO/GEO opportunities are discovered
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.high_priority_recs}
                  onChange={(e) =>
                    setPreferences({ ...preferences, high_priority_recs: e.target.checked })
                  }
                  className="rounded text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    Experiment Outcomes
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Notify when an experiment concludes its measurement window
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.experiment_results}
                  onChange={(e) =>
                    setPreferences({ ...preferences, experiment_results: e.target.checked })
                  }
                  className="rounded text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    GEO Visibility Changes
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Notify when citation presence across AI models shifts significantly
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.geo_visibility_changes}
                  onChange={(e) =>
                    setPreferences({ ...preferences, geo_visibility_changes: e.target.checked })
                  }
                  className="rounded text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    Weekly Intelligence Reports
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Notify when a periodic summary report is compiled and ready
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.weekly_reports}
                  onChange={(e) =>
                    setPreferences({ ...preferences, weekly_reports: e.target.checked })
                  }
                  className="rounded text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                    Automation Failures
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Notify if an external provider API or scheduled job fails
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.automation_failures}
                  onChange={(e) =>
                    setPreferences({ ...preferences, automation_failures: e.target.checked })
                  }
                  className="rounded text-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
              <Button size="sm" variant="outline" onClick={() => setShowPreferences(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSavePreferences} disabled={savingPrefs}>
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
