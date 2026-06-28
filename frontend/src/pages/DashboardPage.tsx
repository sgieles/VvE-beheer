import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { FinancialDashboard } from '@/types'
import { TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

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

  const hasShortfalls = (dashboard?.shortfalls?.length ?? 0) > 0
  const periodeLabel = dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welkom, {user?.full_name ?? user?.username}</p>
      </div>

      {/* Vroege waarschuwing — dringend rood */}
      {dashboard?.vroege_waarschuwing && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertOctagon className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-800">Urgent: tekort verwacht in {dashboard.vroege_waarschuwing.jaar}</p>
            <p className="text-sm text-red-700 mt-1">
              Het reservefonds dreigt{' '}
              <span className="font-medium">{formatCurrency(dashboard.vroege_waarschuwing.verwacht_tekort)}</span>{' '}
              tekort te komen in {dashboard.vroege_waarschuwing.jaar}.{' '}
              <Link to="/financial" className="underline font-medium">Bekijk scenario's →</Link>
            </p>
          </div>
        </div>
      )}

      {/* Tekorten (niet-urgent) */}
      {hasShortfalls && !dashboard?.vroege_waarschuwing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-amber-800">Financieel tekort gedetecteerd</p>
            <p className="text-sm text-amber-700 mt-1">
              Op basis van het MJOP en de huidige bijdragen ontstaan er tekorten in{' '}
              {dashboard?.shortfalls.map((s) => s.year).join(', ')}.{' '}
              <Link to="/financial" className="underline font-medium">Bekijk scenario's →</Link>
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard
          label="Reservefonds huidig"
          value={dashboard ? formatCurrency(dashboard.current_reservefonds_balance) : '—'}
          icon={<TrendingUp size={20} />}
          color="blue"
        />
        <KpiCard
          label={`Bijdrage per ${periodeLabel}`}
          value={dashboard ? formatCurrency(dashboard.current_contribution_per_period) : '—'}
          sublabel={
            dashboard?.bijdrage_per_eenheid != null && dashboard.share_denominator > 1
              ? `€ ${dashboard.bijdrage_per_eenheid.toFixed(2)} per 1/${dashboard.share_denominator} deel`
              : undefined
          }
          icon={<Home size={20} />}
          color="green"
        />
        <KpiCard
          label="Kosten komende 5 jaar"
          value={dashboard ? formatCurrency(dashboard.total_planned_costs_next_5_years) : '—'}
          icon={<TrendingDown size={20} />}
          color="orange"
        />
        <KpiCard
          label="Kosten komende 10 jaar"
          value={dashboard ? formatCurrency(dashboard.total_planned_costs_next_10_years) : '—'}
          icon={<TrendingDown size={20} />}
          color="red"
        />
      </div>

      {/* Bijdrage per appartement */}
      {dashboard && dashboard.bijdrage_per_appartement.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Bijdrage per appartement</h2>
            <p className="text-sm text-gray-500 mt-0.5">Per {periodeLabel}</p>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Appartement</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Eigenaar</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  {dashboard.share_denominator > 1 ? `Aandeel (×1/${dashboard.share_denominator})` : 'Aandeel'}
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Bijdrage per {periodeLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard.bijdrage_per_appartement.map((a) => {
                const totalAandeel = dashboard.bijdrage_per_appartement.reduce((s, x) => s + x.aandeel, 0)
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{a.naam}</p>
                      {a.nummer && <p className="text-xs text-gray-400">{a.nummer}</p>}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-600">{a.eigenaar_naam ?? '—'}</td>
                    <td className="px-6 py-3.5 text-right text-sm text-gray-700">
                      {dashboard.share_denominator > 1
                        ? `${(a.aandeel * dashboard.share_denominator).toFixed(0)}/${dashboard.share_denominator}`
                        : a.aandeel.toFixed(4)}
                      <span className="text-xs text-gray-400 ml-1">
                        ({totalAandeel > 0 ? ((a.aandeel / totalAandeel) * 100).toFixed(1) : '0'}%)
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(a.bijdrage_per_periode)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-6 py-3 text-sm font-medium text-gray-600">Totaal</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  {formatCurrency(dashboard.current_contribution_per_period)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Lege staat: geen appartementen ingesteld */}
      {dashboard && dashboard.bijdrage_per_appartement.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <Home size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Geen appartementen ingesteld</p>
          <p className="text-sm text-gray-400 mt-1">
            <Link to="/appartementen" className="text-primary-600 hover:text-primary-700 font-medium underline">
              Voeg appartementen toe
            </Link>{' '}
            om het bijdrage-overzicht te zien.
          </p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sublabel, icon, color }: {
  label: string
  value: string
  sublabel?: string
  icon: React.ReactNode
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-500',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  )
}
