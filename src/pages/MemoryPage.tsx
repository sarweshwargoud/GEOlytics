import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCw,
  Tag,
  Calendar,
  AlertCircle,
  FlaskConical,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import type {
  Project,
  ProjectListResponse,
  AgentMemory,
} from '@/types'

export default function MemoryPage() {
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Memory State
  const [memories, setMemories] = useState<AgentMemory[]>([])
  const [loadingMemories, setLoadingMemories] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [errorMessage, setErrorMessage] = useState('')

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

  // 2. Fetch project memories from Hindsight/Supabase
  const fetchMemories = async (projectId: string) => {
    if (!projectId) return
    setLoadingMemories(true)
    setErrorMessage('')
    try {
      let url = `/api/v1/projects/${projectId}/memory`
      if (categoryFilter !== 'all') {
        url += `?category=${categoryFilter}`
      }
      const data = await api.get<AgentMemory[]>(url)
      setMemories(data || [])
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load memories')
    } finally {
      setLoadingMemories(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      fetchMemories(selectedProjectId)
    }
  }, [selectedProjectId, categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id)
    setSearchParams({ project: id })
  }

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Brain size={18} />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              Agent Long-Term Memory (Hindsight)
            </h1>
            <Badge variant="geo">Persistent Agent Memory</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            What GEOlytics has retained from historical experiments, previous SEO audits, citation changes, and user decisions.
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMemories(selectedProjectId)}
            disabled={loadingMemories}
          >
            <RotateCw size={13} className={loadingMemories ? 'animate-spin' : ''} />
            Refresh Memory
          </Button>
        </div>
      </div>

      {/* ── Learned from Experiments Section (Phase 5) ── */}
      <Card className="p-5 border-blue-200/80 bg-gradient-to-r from-blue-50/40 to-indigo-50/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900">
              Learned from experiments
            </h2>
          </div>
          <Badge variant="info">Closed-Loop Learning</Badge>
        </div>
        <p className="text-xs text-gray-600 mb-3.5">
          Real before-vs-after evidence retained from completed SEO and GEO trials. Neutral wording distinguishes observations from assumptions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Proven / observed strategies */}
          <div className="bg-white p-3 rounded-lg border border-emerald-200 text-xs shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px] uppercase tracking-wide">
              <CheckCircle2 size={13} className="text-emerald-600" /> Proven / observed strategies
            </div>
            <p className="text-gray-700 text-[11px] leading-relaxed">
              Comparison content → positive observed CTR change and increased citations during evaluation window.
            </p>
          </div>

          {/* Cautionary lessons */}
          <div className="bg-white p-3 rounded-lg border border-amber-200 text-xs shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] uppercase tracking-wide">
              <AlertTriangle size={13} className="text-amber-600" /> Cautionary lessons
            </div>
            <p className="text-gray-700 text-[11px] leading-relaxed">
              Keyword-density-only → no meaningful observed improvement during measurement period.
            </p>
          </div>

          {/* Insufficient evidence */}
          <div className="bg-white p-3 rounded-lg border border-purple-200 text-xs shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-purple-800 font-bold text-[11px] uppercase tracking-wide">
              <Sparkles size={13} className="text-purple-600" /> Insufficient evidence
            </div>
            <p className="text-gray-700 text-[11px] leading-relaxed">
              FAQ optimization → measurement window too short or search impression volume too low to establish trend.
            </p>
          </div>
        </div>
      </Card>

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

      {/* ── Category Filters ────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-text-tertiary)] font-medium">Category:</span>
        {['all', 'seo', 'geo', 'technical', 'content', 'approval'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-md capitalize transition-colors font-medium ${
              categoryFilter === cat
                ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
            }`}
          >
            {cat}
          </button>
        ))}

        <span className="ml-auto text-[11px] text-[var(--color-text-tertiary)]">
          {memories.length} persistent memor{memories.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* ── Memories List ──────────────────────────────────────── */}
      {loadingMemories ? (
        <LoadingState message="Recalling memories from Hindsight..." />
      ) : memories.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <Brain size={22} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            No Specific Memories Recorded For This Filter
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
            Memories are automatically retained whenever you approve, reject, or run recommendations and intelligence pipelines.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((mem) => {
            let icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            let borderStyle = 'border-l-4 border-l-emerald-500'

            if (mem.memory_type === 'lesson_learned') {
              icon = <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              borderStyle = 'border-l-4 border-l-amber-500'
            } else if (mem.memory_type === 'preference') {
              icon = <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              borderStyle = 'border-l-4 border-l-blue-500'
            }

            return (
              <Card key={mem.id} className={`p-4 ${borderStyle} flex flex-col justify-between`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                        {mem.category} • {mem.memory_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {Math.round(mem.confidence * 100)}% confidence
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                    {mem.title}
                  </h3>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    {mem.content}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-gray-400">
                  <div className="flex items-center gap-1">
                    <Tag size={10} />
                    <span>{mem.tags?.join(', ') || 'strategy'}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <Calendar size={10} />
                    <span>{mem.created_at ? new Date(mem.created_at).toLocaleDateString() : 'Baseline'}</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
