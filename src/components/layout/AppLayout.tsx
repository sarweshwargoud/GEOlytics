import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useApi } from '@/hooks/useApi'
import {
  LayoutDashboard,
  Search,
  Bot,
  Lightbulb,
  FlaskConical,
  Brain,
  FileText,
  Sliders,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RotateCw,
} from 'lucide-react'
import type { Project, ProjectListResponse } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  enabled: boolean
  badge?: string | number
}

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const api = useApi()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Project state in sidebar
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const pendingRecsCount = 6

  // Load projects list
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await api.get<ProjectListResponse>('/api/v1/projects')
        const items = res.projects || []
        setProjects(items)
        const qpId = searchParams.get('project') || searchParams.get('projectId')
        if (qpId && items.some((p) => p.id === qpId)) {
          setSelectedProjectId(qpId)
        } else if (items.length > 0) {
          setSelectedProjectId(items[0].id)
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadProjects()
  }, [])

  // Sync selected project with URL query param
  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('project', projId)
    setSearchParams(newParams)
  }

  // Navigation items matching Figma Dev Mode names & order
  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { to: '/technical', label: 'SEO Audit', icon: Search, enabled: true },
    { to: '/seo', label: 'Search Console', icon: TrendingUp, enabled: true },
    { to: '/geo', label: 'GEO Visibility', icon: Bot, enabled: true },
    { to: '/recommendations', label: 'Recommendations', icon: Lightbulb, enabled: true, badge: pendingRecsCount },
    { to: '/experiments', label: 'Experiments', icon: FlaskConical, enabled: true },
    { to: '/memory', label: 'Memory', icon: Brain, enabled: true },
    { to: '/reports', label: 'Reports', icon: FileText, enabled: true },
    { to: '/settings/automation', label: 'Automation', icon: RotateCw, enabled: true },
    { to: '/notifications', label: 'Settings', icon: Settings, enabled: true },
  ]

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const activeProject = projects.find((p) => p.id === selectedProjectId)
  const displayProjectName = activeProject ? activeProject.name : 'atlashealth.io'

  // User display name & initials
  const userEmail = user?.email || 'avery@geolytics.io'
  const userName = userEmail.split('@')[0] === 'avery' ? 'Avery Morgan' : userEmail.split('@')[0]
  const userInitials = userName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex antialiased text-slate-800">
      {/* ── Desktop Sidebar (Figma: #0B132B Dark Navy) ─────── */}
      <aside
        className={`
          hidden lg:flex flex-col sticky top-0 h-screen
          bg-[#0B132B] border-r border-[#182444] transition-all duration-200 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-60'}
          z-30 select-none shrink-0
        `}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-[#182444]">
          <NavLink to="/dashboard" className="flex items-center gap-2.5 group w-full">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 transition-transform duration-200 group-hover:scale-105">
              G
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-white text-sm tracking-tight leading-none">
                  GEOlytics
                </span>
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-1">
                  SEO + GEO INTELLIGENCE
                </span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Project Selector Box */}
        {!collapsed ? (
          <div className="p-3">
            <div className="bg-[#131E36] border border-[#1E2C4F] rounded-lg p-2.5 transition-colors">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                CURRENT PROJECT
              </span>
              <div className="relative flex items-center justify-between">
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full bg-transparent text-white font-medium text-xs appearance-none pr-5 cursor-pointer focus:outline-none truncate"
                >
                  {projects.length > 0 ? (
                    projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0B132B] text-white">
                        {p.name}
                      </option>
                    ))
                  ) : (
                    <option value="" className="bg-[#0B132B] text-white">
                      {displayProjectName}
                    </option>
                  )}
                </select>
                <ChevronDown size={12} className="text-slate-400 absolute right-0 pointer-events-none" />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 border-b border-[#182444] text-center">
            <span className="text-[10px] text-slate-400 font-mono">PRJ</span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.enabled ? `${item.to}${selectedProjectId ? `?project=${selectedProjectId}` : ''}` : '#'}
                onClick={(e) => {
                  if (!item.enabled) e.preventDefault()
                }}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center rounded-lg text-xs font-medium transition-all duration-150 ${
                    collapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5'
                  } ${
                    !item.enabled
                      ? 'text-slate-500 cursor-default opacity-50'
                      : isActive
                        ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={16}
                      className={`shrink-0 transition-transform duration-150 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                      }`}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate tracking-tight">{item.label}</span>
                    )}
                    {!collapsed && item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[#1E2C4F] text-blue-300 border border-blue-400/20'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Growth Workspace Card */}
        {!collapsed && (
          <div className="p-3 mt-auto">
            <div className="bg-[#131E36] border border-[#1E2C4F] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-xs font-semibold">Growth workspace</span>
                <span className="bg-[#2563EB] text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                  PRO
                </span>
              </div>
              <p className="text-slate-400 text-[10px]">
                18 / 25 tracked GEO queries
              </p>
              <div className="w-full bg-[#1E2C4F] rounded-full h-1 mt-2 overflow-hidden">
                <div className="bg-[#2563EB] h-full rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Collapse Toggle */}
        <div className="p-3 border-t border-[#182444] flex items-center justify-between">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors ${
              collapsed ? 'mx-auto' : 'ml-auto'
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar width"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      {/* ── Main Column ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 h-14 transition-all">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              {/* Global Search Bar (Figma spec: Search insights, pages, queries... ⌘ K) */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 w-72 lg:w-96 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search insights, pages, queries..."
                  className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
                />
                <kbd className="hidden md:inline-flex items-center gap-0.5 bg-white border border-slate-200 text-slate-400 rounded px-1.5 py-0.5 text-[10px] font-mono shadow-2xs shrink-0">
                  ⌘ K
                </kbd>
              </div>
            </div>

            {/* Right Header items */}
            <div className="flex items-center gap-4">
              {/* Telemetry Sync status */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Synced 12 min ago</span>
              </div>

              {/* Notifications Shortcut */}
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `relative p-2 rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`
                }
                title="Notifications & Alerts"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
              </NavLink>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200" />

              {/* User menu dropdown (Figma: AM Avery Morgan / Workspace admin) */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold shadow-2xs shrink-0">
                    {userInitials}
                  </div>
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 leading-tight">
                      {userName}
                    </span>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Workspace admin
                    </span>
                  </div>
                  <ChevronDown size={12} className="text-slate-400 ml-0.5" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/90 rounded-xl shadow-lg z-50 py-1.5 animate-scale-in divide-y divide-slate-100">
                      <div className="px-3.5 py-2.5">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Signed in as
                        </p>
                        <p className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                          {user?.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <NavLink
                          to="/settings/automation"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        >
                          <Sliders size={14} className="text-slate-400" />
                          Automation Settings
                        </NavLink>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                        >
                          <LogOut size={14} />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Mobile Drawer (Slide In) ──────────────────────── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-64 bg-[#0B132B] text-white border-r border-[#182444] shadow-2xl z-50 flex flex-col animate-slide-in-right">
              <div className="p-4 border-b border-[#182444] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-xs">
                    G
                  </div>
                  <span className="font-bold text-sm text-white">GEOlytics</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.enabled ? `${item.to}${selectedProjectId ? `?project=${selectedProjectId}` : ''}` : '#'}
                      onClick={(e) => {
                        if (!item.enabled) e.preventDefault()
                        else setMobileOpen(false)
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                          !item.enabled
                            ? 'text-slate-500 cursor-default opacity-50'
                            : isActive
                              ? 'bg-[#2563EB] text-white font-semibold'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`
                      }
                    >
                      <Icon size={16} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="text-[10px] text-blue-300 bg-[#1E2C4F] px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </nav>

              <div className="p-4 border-t border-[#182444]">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left py-2 px-3 text-xs font-medium text-rose-400 hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Canvas Content Area (Figma: #F8FAFC) ─────── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
