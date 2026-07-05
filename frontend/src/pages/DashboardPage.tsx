import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type {
  FinancialDashboard, BalanceRow, QuarterRow,
  ScenarioResult, ScenarioContributionIncrease, ScenarioDeferActivity, ScenarioOneTimeLevy,
} from '@/types'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, Home, CheckCircle, Clock, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

function formatEur(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
function formatEurFull(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)
}

type YearRange = 5 | 10 | 20 | 'alles'
type Granularity = 'jaar' | 'kwartaal'

type ChartRow = { label: string; costs: number; contributions: number; balance: number; isShortfall: boolean }

function toChartRows(rows: (BalanceRow | QuarterRow)[], useLabel: boolean): ChartRow[] {
  return rows.map((row) => ({
    label: useLabel ? (row as QuarterRow).label : String(row.year),
    costs: Math.round(row.costs),
    contributions: Math.round(row.contributions),
    balance: Math.round(row.balance),
    isShortfall: row.balance < 0,
  }))
}

export default function DashboardPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const [yearRange, setYearRange] = useState<YearRange>(10)
  const [inflatie, setInflatie] = useState(0)
  const [granularity, setGranularity] = useState<Granularity>('jaar')

  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ['dashboard', vveId, inflatie],
    queryFn: () =>
      api.get(`/vves/${vveId}/financial/dashboard?inflatie=${inflatie}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const hasShortfalls = (dashboard?.shortfalls?.length ?? 0) > 0
  const periodeLabel = dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'
  const allChartData: ChartRow[] = granularity === 'kwartaal'
    ? toChartRows(dashboard?.projected_balance_by_quarter ?? [], true)
    : toChartRows(dashboard?.projected_balance_by_year ?? [], false)

  const chartData = yearRange === 'alles'
    ? allChartData
    : allChartData.filter((_, i) => {
        const limit = granularity === 'kwartaal' ? yearRange * 4 : yearRange
        return i < (limit as number)
      })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welkom, {user?.full_name ?? user?.username}</p>
      </div>

      {/* Vroege waarschuwing — urgent rood */}
      {dashboard?.vroege_waarschuwing && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertOctagon className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-800">
              Urgent: tekort verwacht in {dashboard.vroege_waarschuwing.jaar}
            </p>
            <p className="text-sm text-red-700 mt-1">
              Het reservefonds dreigt{' '}
              <span className="font-medium">{formatEurFull(dashboard.vroege_waarschuwing.verwacht_tekort)}</span>{' '}
              tekort te komen.{' '}
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
              Tekorten verwacht in{' '}
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
          value={dashboard ? formatEurFull(dashboard.current_reservefonds_balance) : '—'}
          icon={<TrendingUp size={20} />}
          color="blue"
        />
        <KpiCard
          label={`Bijdrage per ${periodeLabel}`}
          value={dashboard ? formatEurFull(dashboard.current_contribution_per_period) : '—'}
          sublabel={
            dashboard?.bijdrage_per_eenheid != null && dashboard.share_denominator > 1
              ? `${formatEurFull(dashboard.bijdrage_per_eenheid)} per 1/${dashboard.share_denominator} deel`
              : undefined
          }
          icon={<Home size={20} />}
          color="green"
        />
        <KpiCard
          label="Kosten komende 5 jaar"
          value={dashboard ? formatEur(dashboard.total_planned_costs_next_5_years) : '—'}
          icon={<TrendingDown size={20} />}
          color="orange"
        />
        <KpiCard
          label="Kosten komende 10 jaar"
          value={dashboard ? formatEur(dashboard.total_planned_costs_next_10_years) : '—'}
          icon={<TrendingDown size={20} />}
          color="red"
        />
      </div>

      {/* Gezond-indicator — alleen tonen als er MJOP-data is maar geen tekorten */}
      {chartData.length > 0 && !hasShortfalls && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <CheckCircle className="text-green-500 shrink-0" size={20} />
          <div>
            <p className="font-medium text-green-800">Reservefonds is financieel gezond</p>
            <p className="text-sm text-green-700 mt-0.5">
              Geen tekorten verwacht op basis van het huidige MJOP en bijdrageplan.
            </p>
          </div>
        </div>
      )}

      {/* Balans-grafiek */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          {/* Header met filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-base font-semibold text-gray-900">Prognose reservefonds</h2>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Granulariteit toggle */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {(['jaar', 'kwartaal'] as Granularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                      granularity === g
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {/* Inflatie slider */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">Inflatie MJOP:</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={inflatie}
                  onChange={(e) => setInflatie(parseFloat(e.target.value))}
                  className="w-20 accent-primary-600"
                />
                <span className="text-xs font-medium text-gray-700 w-8">{inflatie}%</span>
              </div>
              {/* Jaar-filter */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([5, 10, 20, 'alles'] as YearRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setYearRange(r)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      yearRange === r
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {r === 'alles' ? 'Alles' : `${r} jr`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `€${Math.abs(v / 1000).toFixed(0)}k${v < 0 ? '-' : ''}`}
                tick={{ fontSize: 11 }}
                width={52}
              />
              <Tooltip
                formatter={(v: number, name: string) => [formatEur(v), name]}
                labelFormatter={(l) => String(l)}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />

              {/* Bijdragen (groen) */}
              <Bar dataKey="contributions" name="Bijdragen" fill="#22c55e" opacity={0.85} radius={[2, 2, 0, 0]} />

              {/* Kosten (rood) */}
              <Bar dataKey="costs" name="Kosten" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isShortfall ? '#ef4444' : '#f97316'} opacity={0.85} />
                ))}
              </Bar>

              {/* Saldo-lijn (blauw) */}
              <Line
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  return (
                    <circle
                      key={payload.year}
                      cx={cx}
                      cy={cy}
                      r={payload.isShortfall ? 5 : 3}
                      fill={payload.isShortfall ? '#ef4444' : '#3b82f6'}
                      strokeWidth={0}
                    />
                  )
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legenda extra uitleg */}
          {inflatie > 0 && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              MJOP-kosten verhoogd met {inflatie}% inflatie per jaar
            </p>
          )}
        </div>
      )}

      {/* Tekortanalyse */}
      {(dashboard?.shortfalls?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Tekortanalyse</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Jaren waarop het reservefonds negatief wordt
            </p>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Jaar</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Kosten</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Bijdragen</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Saldo</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Tekort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard?.shortfalls.map((s) => {
                const row = dashboard.projected_balance_by_year.find((r) => r.year === s.year)
                return (
                  <tr key={s.year} className="bg-red-50/50">
                    <td className="px-6 py-3 font-medium text-red-700">{s.year}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-700">{row ? formatEur(row.costs) : '—'}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-700">{row ? formatEur(row.contributions) : '—'}</td>
                    <td className="px-6 py-3 text-right text-sm text-red-600 font-medium">{row ? formatEur(row.balance) : '—'}</td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-red-700">{formatEur(s.shortfall)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <Link to="/financial" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Bekijk scenario's om tekorten op te lossen →
            </Link>
          </div>
        </div>
      )}

      {/* Financiële gezondheidsanalyse — risico-overzicht + scenario's */}
      {hasShortfalls && (dashboard?.scenarios?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100 bg-red-50/60">
            <h2 className="text-base font-semibold text-gray-900">Financiële gezondheidsanalyse</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Posten die het reservefonds in gevaar brengen en mogelijke aanpakken
            </p>
          </div>

          {/* Risico-overzicht tabel */}
          {(dashboard!.risico_items?.length ?? 0) > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-6 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-gray-700">Risico-overzicht per post</h3>
                <p className="text-xs text-gray-400 mt-0.5">MJOP-posten in jaren met een tekort, gesorteerd op bedrag</p>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Post</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Jaar</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Bedrag</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Tekort dat jaar</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Risico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboard!.risico_items.map((item) => (
                    <tr key={item.id} className={item.is_hoofdoorzaak ? 'bg-red-50/40' : ''}>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {item.description.length > 45 ? item.description.slice(0, 42) + '…' : item.description}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-600">
                        {item.planned_year}{item.planned_quarter ? ` Q${item.planned_quarter}` : ''}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        {formatEur(item.planned_amount)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-red-600">
                        -{formatEur(item.tekort_in_jaar)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {item.is_hoofdoorzaak ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Hoofdoorzaak</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">Bijdragend</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Scenario-kaarten */}
          <div className="px-6 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-700">Mogelijke aanpakken</h3>
          </div>
          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard!.scenarios.map((s, i) => (
              <ScenarioCard
                key={i}
                scenario={s}
                periodeLabel={periodeLabel}
                shareDenominator={dashboard!.share_denominator}
              />
            ))}
          </div>
        </div>
      )}

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
                  Aandeel
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
                        ? `${a.aandeel.toFixed(0)}/${dashboard.share_denominator}`
                        : a.aandeel.toFixed(4)}
                      <span className="text-xs text-gray-400 ml-1">
                        ({totalAandeel > 0 ? ((a.aandeel / totalAandeel) * 100).toFixed(1) : '0'}%)
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-sm font-medium text-gray-900">
                      {formatEurFull(a.bijdrage_per_periode)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-6 py-3 text-sm font-medium text-gray-600">Totaal</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  {formatEurFull(dashboard.current_contribution_per_period)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Lege staat */}
      {dashboard && dashboard.bijdrage_per_appartement.length === 0 && chartData.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <Home size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Nog geen data beschikbaar</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload een{' '}
            <Link to="/financial" className="text-primary-600 hover:text-primary-700 font-medium underline">MJOP</Link>
            {' '}en voeg{' '}
            <Link to="/appartementen" className="text-primary-600 hover:text-primary-700 font-medium underline">appartementen</Link>
            {' '}toe om te beginnen.
          </p>
        </div>
      )}
    </div>
  )
}

function ScenarioCard({ scenario, periodeLabel, shareDenominator }: {
  scenario: ScenarioResult
  periodeLabel: string
  shareDenominator: number
}) {
  if (scenario.scenario_type === 'contribution_increase') {
    const s = scenario as ScenarioContributionIncrease
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <TrendingUp size={15} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold text-blue-900">Bijdrage verhogen</h3>
        </div>
        <p className="text-xl font-bold text-blue-900">
          +{formatEurFull(s.increase_per_period_per_unit_aandeel)}
        </p>
        <p className="text-xs text-blue-700 mb-2">
          per 1/{shareDenominator} deel per {periodeLabel}
        </p>
        <p className="text-xs text-blue-600">
          Nieuw totaal: {formatEurFull(s.new_contribution_per_period)} per {periodeLabel}
        </p>
      </div>
    )
  }

  if (scenario.scenario_type === 'defer_activity') {
    const s = scenario as ScenarioDeferActivity
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-amber-100 rounded-lg">
            <Clock size={15} className="text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-amber-900">Kosten uitstellen</h3>
        </div>
        <p className="text-xl font-bold text-amber-900">
          {s.suggested_deferrals.length} post{s.suggested_deferrals.length === 1 ? '' : 'en'}
        </p>
        <p className="text-xs text-amber-700 mb-2">1 jaar verschuiven</p>
        <ul className="space-y-1">
          {s.suggested_deferrals.slice(0, 3).map((d) => (
            <li key={d.item_id} className="text-xs text-amber-800">
              {d.description.length > 28 ? d.description.slice(0, 25) + '…' : d.description}
              {': '}{d.original_year} → {d.proposed_year}
            </li>
          ))}
          {s.suggested_deferrals.length > 3 && (
            <li className="text-xs text-amber-600">en {s.suggested_deferrals.length - 3} meer…</li>
          )}
        </ul>
      </div>
    )
  }

  if (scenario.scenario_type === 'one_time_levy') {
    const s = scenario as ScenarioOneTimeLevy
    const uniqueAandelen = [...new Set(s.per_member_breakdown.map((m) => m.aandeel))].sort((a, b) => b - a)
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-purple-100 rounded-lg">
            <Zap size={15} className="text-purple-600" />
          </div>
          <h3 className="text-sm font-semibold text-purple-900">Eenmalige bijdrage</h3>
        </div>
        <p className="text-xl font-bold text-purple-900">{formatEur(s.total_levy)}</p>
        <p className="text-xs text-purple-700 mb-2">
          {formatEur(s.levy_per_full_aandeel)} per aandeel-eenheid
        </p>
        <ul className="space-y-0.5">
          {uniqueAandelen.slice(0, 4).map((aandeel) => (
            <li key={aandeel} className="text-xs text-purple-800">
              {aandeel}/{shareDenominator} aandeel: {formatEur(aandeel * s.levy_per_full_aandeel)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
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
