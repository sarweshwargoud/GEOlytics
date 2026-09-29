import { useState, useEffect } from 'react'
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
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/StateDisplay'
import { useApi } from '@/hooks/useApi'
import { useProject } from '@/contexts/ProjectContext'
import type {
  AgentMemory,
} from '@/types'

export default function MemoryPage() {
  const api = useApi()
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loadingProjects,
  } = useProject()

  // Memory State
  const [memories, setMemories] = useState<AgentMemory[]>([])
  const [loadingMemories, setLoadingMemories] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

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
  }

  const filteredMemories = memories.filter((m) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
    )
  })

  if (loadingProjects) {
    return <LoadingState message="Loading projects..." />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Agent Long-Term Memory (Hindsight)
            </h1>
            <Badge variant="geo">Persistent Recall</Badge>
          </div>
          <p className="text-xs text-slate-500">
            Retained intelligence from historical experiments, previous SEO audits, citation changes, and user decisions.
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchMemories(selectedProjectId)}
            disabled={loadingMemories}
          >
            <RotateCw size={13} className={loadingMemories ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Learned from Experiments Section (Phase 5) ── */}
      <Card hoverLift className="p-5 border-blue-200/80 bg-gradient-to-r from-blue-50/30 via-white to-indigo-50/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Closed-Loop Experiment Learnings
            </h2>
          </div>
          <Badge variant="info">Verified Post-Measurement</Badge>
        </div>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Concrete before-vs-after evidence retained from completed SEO and GEO trials. Neutral wording distinguishes observations from assumptions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Proven / observed strategies */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-xs shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px] uppercase tracking-wide">
              <CheckCircle2 size={13} className="text-emerald-600" /> Proven Strategies
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Comparison content → positive observed CTR change and increased citations during evaluation window.
            </p>
          </div>

          {/* Cautionary lessons */}
          <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-xs shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] uppercase tracking-wide">
              <AlertTriangle size={13} className="text-amber-600" /> Cautionary Precedents
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Keyword-density-only → no meaningful observed improvement during measurement period.
            </p>
          </div>

          {/* Insufficient evidence */}
          <div className="bg-white p-3.5 rounded-xl border border-purple-200 text-xs shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-purple-800 font-bold text-[11px] uppercase tracking-wide">
              <Sparkles size={13} className="text-purple-600" /> Insufficient Evidence
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              FAQ optimization → measurement window too short or search impression volume too low to establish trend.
            </p>
          </div>
        </div>
      </Card>

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

      {/* ── Search & Category Filters ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
          {['all', 'seo', 'geo', 'technical', 'content', 'approval'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-md capitalize transition-all font-medium ${
                categoryFilter === cat
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search size={13} />}
          />
        </div>
      </div>

      {/* ── Memories List ──────────────────────────────────────── */}
      {loadingMemories ? (
        <LoadingState message="Recalling memories from Hindsight..." type="skeleton" />
      ) : filteredMemories.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-slate-300">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <Brain size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            No Specific Memories Found
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Memories are automatically retained whenever you approve, reject, or complete experiments and intelligence pipelines.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((mem, index) => {
            let icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            let borderStyle = 'border-l-4 border-l-emerald-500'

            if (mem.memory_type === 'lesson_learned') {
              icon = <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              borderStyle = 'border-l-4 border-l-amber-500'
            } else if (mem.memory_type === 'preference') {
              icon = <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              borderStyle = 'border-l-4 border-l-blue-500'
            }

            const isExpanded = expandedMemoryId === mem.id

            return (
              <Card
                key={mem.id}
                hoverLift
                className={`p-4 ${borderStyle} flex flex-col justify-between transition-all`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {mem.category} • {mem.memory_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {Math.round(mem.confidence * 100)}% confidence
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900">
                    {mem.title}
                  </h3>

                  <p
                    className={`text-xs text-slate-600 leading-relaxed ${
                      !isExpanded && mem.content.length > 180 ? 'line-clamp-3' : ''
                    }`}
                  >
                    {mem.content}
                  </p>

                  {mem.content.length > 180 && (
                    <button
                      onClick={() => setExpandedMemoryId(isExpanded ? null : mem.id)}
                      className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5 pt-0.5"
                    >
                      {isExpanded ? 'Show less' : 'Read full insight'}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
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
