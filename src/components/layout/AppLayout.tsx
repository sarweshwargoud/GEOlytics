import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import Badge from '@/components/ui/Badge'

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, enabled: true },
  { to: '/seo', label: 'Search Console', icon: Search, enabled: true },
  { to: '/geo', label: 'AI Visibility (GEO)', icon: Bot, enabled: true },
  { to: '/keywords', label: 'Keywords', icon: Key, enabled: false },
  { to: '/competitors', label: 'Competitors', icon: Globe, enabled: false },
  { to: '/technical', label: 'Technical Audit', icon: Wrench, enabled: true },
  { to: '/recommendations', label: 'Recommendations', icon: Lightbulb, enabled: true },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical, enabled: true },
  { to: '/memory', label: 'Memory', icon: Brain, enabled: true },
  { to: '/reports', label: 'Reports', icon: FileText, enabled: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, enabled: true },
  { to: '/settings/automation', label: 'Automation', icon: Settings, enabled: true },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-secondary)]">
      {/* ── Top Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)] h-14">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-md hover:bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-600)] flex items-center justify-center">
                <Search size={15} className="text-white" />
              </div>
              <span className="font-semibold text-[var(--color-text-primary)] text-sm tracking-tight">
                SEO+GEO Intelligence
              </span>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-primary)]'
                }`
              }
              title="Notifications & Alerts"
            >
              <Bell size={17} />
            </NavLink>

            {/* User menu */}
            <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="User menu"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] flex items-center justify-center text-xs font-semibold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:block max-w-[180px] truncate text-[var(--color-text-secondary)]">
                {user?.email}
              </span>
              <ChevronDown size={14} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Signed in as</p>
                    <p className="text-sm text-[var(--color-text-primary)] truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] flex items-center gap-2"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside
          className={`
            fixed lg:sticky top-14 z-30 h-[calc(100vh-3.5rem)] overflow-y-auto
            w-60 bg-[var(--color-surface)] border-r border-[var(--color-border)]
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          <nav className="p-3 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.enabled ? item.to : '#'}
                onClick={(e) => {
                  if (!item.enabled) { e.preventDefault(); return }
                  setSidebarOpen(false)
                }}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !item.enabled
                      ? 'text-[var(--color-text-tertiary)] cursor-default'
                      : isActive
                        ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-primary)]'
                  }`
                }
              >
                <item.icon size={16} />
                <span className="flex-1">{item.label}</span>
                {!item.enabled && (
                  <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-tertiary)] px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Badge variant="seo">SEO</Badge>
              <Badge variant="geo">GEO</Badge>
              <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">v0.1.0</span>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Main Content ──────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
