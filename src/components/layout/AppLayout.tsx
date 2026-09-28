import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Search,
  Bot,
  Key,
  Globe,
  Wrench,
  Lightbulb,
  FlaskConical,
  Brain,
  FileText,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  enabled: boolean
  badge?: string
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, enabled: true },
  { to: '/seo', label: 'Search Console', icon: Search, enabled: true },
  { to: '/geo', label: 'AI Visibility (GEO)', icon: Bot, enabled: true },
  { to: '/technical', label: 'Technical Audit', icon: Wrench, enabled: true },
  { to: '/recommendations', label: 'Recommendations', icon: Lightbulb, enabled: true },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical, enabled: true },
  { to: '/memory', label: 'Hindsight Memory', icon: Brain, enabled: true },
  { to: '/reports', label: 'Reports', icon: FileText, enabled: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, enabled: true },
  { to: '/settings/automation', label: 'Automation', icon: Settings, enabled: true },
  { to: '/keywords', label: 'Keywords', icon: Key, enabled: false, badge: 'Soon' },
  { to: '/competitors', label: 'Competitors', icon: Globe, enabled: false, badge: 'Soon' },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-800">
      {/* ── Top Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 h-14 transition-all">
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

            {/* Brand Logo */}
            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                <Sparkles size={16} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                  GEOlytics
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    SaaS
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline -mt-0.5">
                  AI Search & SEO Intelligence
                </span>
              </div>
            </NavLink>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-2.5">
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
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </NavLink>

            {/* Divider */}
            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* User menu dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none"
                aria-label="User menu"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden md:block max-w-[140px] truncate text-xs font-medium text-slate-700">
                  {user?.email?.split('@')[0]}
                </span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/90 rounded-xl shadow-lg z-50 py-1.5 animate-scale-in divide-y divide-slate-100">
                    <div className="px-3.5 py-2.5">
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Authenticated
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
                        <Settings size={14} className="text-slate-400" />
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

      <div className="flex-1 flex w-full">
        {/* ── Sidebar (Desktop) ─────────────────────────────── */}
        <aside
          className={`
            hidden lg:flex flex-col sticky top-14 h-[calc(100vh-3.5rem)]
            bg-white border-r border-slate-200/90 transition-all duration-200 ease-in-out
            ${collapsed ? 'w-18' : 'w-60'}
            z-30 select-none
          `}
        >
          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.enabled ? item.to : '#'}
                  onClick={(e) => {
                    if (!item.enabled) e.preventDefault()
                  }}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-lg text-xs font-medium transition-all duration-150 ${
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 gap-2.5'
                    } ${
                      !item.enabled
                        ? 'text-slate-400 cursor-default opacity-60'
                        : isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active indicator bar */}
                      {isActive && item.enabled && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-blue-600" />
                      )}
                      <Icon
                        size={17}
                        className={`shrink-0 transition-transform duration-150 ${
                          item.enabled ? 'group-hover:scale-110' : ''
                        } ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate tracking-tight">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Sidebar Footer with Collapse Toggle */}
          <div className="p-3 border-t border-slate-100 flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-1.5">
                <Badge variant="seo" className="text-[10px] py-0 px-2">SEO</Badge>
                <Badge variant="geo" className="text-[10px] py-0 px-2">GEO</Badge>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${
                collapsed ? 'mx-auto' : 'ml-auto'
              }`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label="Toggle sidebar width"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </aside>

        {/* ── Mobile Drawer (Slide In) ──────────────────────── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 shadow-xl z-50 flex flex-col animate-slide-in-right">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                    <Sparkles size={14} />
                  </div>
                  <span className="font-bold text-sm text-slate-900">GEOlytics</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
                      to={item.enabled ? item.to : '#'}
                      onClick={(e) => {
                        if (!item.enabled) e.preventDefault()
                        else setMobileOpen(false)
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                          !item.enabled
                            ? 'text-slate-400 cursor-default opacity-60'
                            : isActive
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Icon size={17} className="text-slate-500" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left py-2 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content Area ─────────────────────────────── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
