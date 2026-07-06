import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { User, VvE } from '@/types'
import {
  LayoutDashboard, Home, TrendingUp, CalendarDays, LogOut,
  Building2, ChevronDown, ShieldCheck, Info, FolderOpen, Settings, Users, FileBarChart2, ClipboardList, CreditCard, Wrench,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/appartementen', label: 'Appartementen', icon: Home },
  { to: '/financial', label: 'Financieel', icon: TrendingUp },
  { to: '/meetings', label: 'Vergaderingen', icon: CalendarDays },
  { to: '/documents', label: 'Documenten', icon: FolderOpen },
  { to: '/members', label: 'Leden', icon: Users },
  { to: '/meldingen', label: 'Meldingen', icon: Wrench },
  { to: '/betalingen', label: 'Betalingen', icon: CreditCard },
  { to: '/taken', label: 'Actiepunten', icon: ClipboardList },
  { to: '/rapport', label: 'Rapport', icon: FileBarChart2 },
]

export default function Layout() {
  const { logout, user, activeVveId, activeVve, setActiveVve } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'platform_admin'

  const { data: me } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  })

  const { data: vves = [] } = useQuery<VvE[]>({
    queryKey: ['vves'],
    queryFn: () => api.get('/vves').then((r) => r.data),
    enabled: !!user,
  })

  // Zet activeVve zodra de lijst geladen is
  useEffect(() => {
    if (vves.length > 0 && !activeVve) {
      const current = vves.find((v) => v.id === activeVveId) ?? vves[0]
      setActiveVve(current)
    }
  }, [vves, activeVveId, activeVve, setActiveVve])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const displayVve = activeVve ?? vves.find((v) => v.id === activeVveId)
  const showVveSwitcher = vves.length > 1 || isAdmin

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">

        {/* VvE-selector */}
        <div className="p-4 border-b border-gray-200">
          {showVveSwitcher ? (
            <VvESwitcher vves={vves} active={displayVve} onSelect={setActiveVve} />
          ) : (
            <div className="flex items-center gap-2">
              <Building2 className="text-primary-600 shrink-0" size={20} />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight truncate">
                  {displayVve?.name ?? '…'}
                </p>
                <p className="text-xs text-gray-400">VvE Beheer Platform</p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <ShieldCheck size={18} />
              Admin overzicht
            </NavLink>
          )}
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-2 space-y-1">
          <NavLink
            to="/instellingen"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Settings size={18} />
            Instellingen
          </NavLink>
          <NavLink
            to="/info"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Info size={18} />
            Hoe werkt het?
          </NavLink>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-gray-900">{me?.full_name ?? me?.username}</p>
            <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
              {user?.role === 'platform_admin' && <ShieldCheck size={11} className="text-amber-500" />}
              {user?.role === 'platform_admin' ? 'Platform Admin' : user?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function VvESwitcher({ vves, active, onSelect }: {
  vves: VvE[]; active: VvE | undefined; onSelect: (v: VvE) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full hover:bg-gray-50 rounded-lg p-1 -ml-1 transition-colors"
      >
        <Building2 className="text-primary-600 shrink-0" size={20} />
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">
            {active?.name ?? '…'}
          </p>
          <p className="text-xs text-gray-400">VvE wisselen</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {vves.map((v) => (
            <button
              key={v.id}
              onClick={() => { onSelect(v); setOpen(false) }}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                v.id === active?.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
              }`}
            >
              <Building2 size={14} className="shrink-0" />
              <span className="truncate">{v.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
