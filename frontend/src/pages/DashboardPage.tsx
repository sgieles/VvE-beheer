import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { FinancialDashboard, Meeting } from '@/types'
import { TrendingUp, TrendingDown, CalendarDays, Users, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value)
}

export default function DashboardPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId

  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ['dashboard', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/dashboard`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ['meetings', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meetings`).then((r) => r.data),
    enabled: !!vveId,
  })

  const nextMeeting = meetings?.find((m) => m.status === 'planned' && new Date(m.meeting_date) > new Date())
  const hasShortfalls = (dashboard?.shortfalls?.length ?? 0) > 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welkom, {user?.full_name ?? user?.username}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard
          label="Reservefonds"
          value={dashboard ? formatCurrency(dashboard.current_reservefonds_balance) : '—'}
          icon={<TrendingUp size={20} />}
          color="blue"
        />
        <KpiCard
          label={`Bijdrage per ${dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'}`}
          value={dashboard ? formatCurrency(dashboard.current_contribution_per_period) : '—'}
          icon={<Users size={20} />}
          color="green"
        />
        <KpiCard
          label="Kosten komende 5 jaar"
          value={dashboard ? formatCurrency(dashboard.total_planned_costs_next_5_years) : '—'}
          icon={<TrendingDown size={20} />}
          color="orange"
        />
        <KpiCard
          label="Volgende vergadering"
          value={nextMeeting ? format(new Date(nextMeeting.meeting_date), 'd MMM yyyy', { locale: nl }) : 'Geen gepland'}
          icon={<CalendarDays size={20} />}
          color="purple"
        />
      </div>

      {/* Waarschuwing tekorten */}
      {hasShortfalls && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-amber-800">Financieel tekort gedetecteerd</p>
            <p className="text-sm text-amber-700 mt-1">
              Op basis van het MJOP en de huidige bijdragen ontstaan er tekorten in{' '}
              {dashboard?.shortfalls.map((s) => s.year).join(', ')}.{' '}
              Bekijk de <a href="/financial" className="underline font-medium">Financieel</a> module voor scenario's.
            </p>
          </div>
        </div>
      )}

      {/* Aankomende vergadering */}
      {nextMeeting && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aankomende vergadering</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{nextMeeting.title}</p>
              <p className="text-sm text-gray-500 mt-1">
                {format(new Date(nextMeeting.meeting_date), "EEEE d MMMM yyyy 'om' HH:mm", { locale: nl })}
              </p>
              {nextMeeting.location && (
                <p className="text-sm text-gray-500">{nextMeeting.location}</p>
              )}
            </div>
            {nextMeeting.teams_url && (
              <a
                href={nextMeeting.teams_url}
                target="_blank"
                rel="noreferrer"
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Deelnemen via Teams
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}
