import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type {
  FinancialDashboard, BalanceRow, QuarterRow,
  ScenarioResult, ScenarioContributionIncrease, ScenarioDeferActivity, ScenarioOneTimeLevy,
  SmartPlanResult, Announcement, Meeting, MeldingStats,
} from '@/types'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, Home, CheckCircle, Clock, Zap, Plus, X, Wand2, ChevronDown, ChevronUp, Megaphone, Pin, Trash2, CalendarDays, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'

function formatEur(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
function formatEurFull(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)
}

type YearRange = 5 | 10 | 20 | 'alles'
type Granularity = 'jaar' | 'kwartaal'

type SimulatiePost = { id: string; description: string; year: number; amount: number }
type AdjRow = (BalanceRow | QuarterRow) & { adjustedBalance: number }
type ChartRow = {
  label: string; costs: number; contributions: number; balance: number
  isShortfall: boolean; adjustedBalance: number; isAdjustedShortfall: boolean
}

function toChartRows(rows: AdjRow[], useLabel: boolean): ChartRow[] {
  return rows.map((row) => ({
    label: useLabel ? (row as QuarterRow).label : String(row.year),
    costs: Math.round(row.costs),
    contributions: Math.round(row.contributions),
    balance: Math.round(row.balance),
    isShortfall: row.balance < 0,
    adjustedBalance: Math.round(row.adjustedBalance),
    isAdjustedShortfall: row.adjustedBalance < 0,
  }))
}

export default function DashboardPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const [yearRange, setYearRange] = useState<YearRange>(10)
  const [inflatie, setInflatie] = useState(0)
  const [granularity, setGranularity] = useState<Granularity>('jaar')
  const [simulatiePosts, setSimulatiePosts] = useState<SimulatiePost[]>([])
  const [showSimForm, setShowSimForm] = useState(false)
  const [simForm, setSimForm] = useState({ description: '', year: new Date().getFullYear(), amount: '' })
  const [savingSimulatie, setSavingSimulatie] = useState(false)
  const [showSlimPlan, setShowSlimPlan] = useState(false)
  const [showBijdrageTable, setShowBijdrageTable] = useState(false)
  const [showAnnForm, setShowAnnForm] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', content: '', is_pinned: false })
  const qc = useQueryClient()

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements', vveId],
    queryFn: () => api.get(`/vves/${vveId}/announcements`).then((r) => r.data),
    enabled: !!vveId,
  })

  const createAnn = useMutation({
    mutationFn: () => api.post(`/vves/${vveId}/announcements`, annForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements', vveId] })
      setAnnForm({ title: '', content: '', is_pinned: false })
      setShowAnnForm(false)
    },
  })

  const deleteAnn = useMutation({
    mutationFn: (id: number) => api.delete(`/vves/${vveId}/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements', vveId] }),
  })

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ['meetings', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meetings`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: meldingStats } = useQuery<MeldingStats>({
    queryKey: ['meldingen-stats', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meldingen/stats`).then((r) => r.data),
    enabled: !!vveId,
  })

  const upcomingMeeting = meetings
    .filter((m) => m.status === 'planned' && new Date(m.meeting_date) > new Date())
    .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())[0]

  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ['dashboard', vveId, inflatie],
    queryFn: () =>
      api.get(`/vves/${vveId}/financial/dashboard?inflatie=${inflatie}`).then((r) => r.data),
    enabled: !!vveId,
  })

  // Simulatie: aangepaste cashflow (cumulatief saldo verlaagd per simulatiejaar)
  const simCostByYear: Record<number, number> = {}
  for (const p of simulatiePosts) simCostByYear[p.year] = (simCostByYear[p.year] ?? 0) + p.amount

  const adjYearly: AdjRow[] = (() => {
    let cum = 0
    return (dashboard?.projected_balance_by_year ?? []).map((row) => {
      cum += simCostByYear[row.year] ?? 0
      return { ...row, adjustedBalance: row.balance - cum }
    })
  })()

  const adjQuarterly: AdjRow[] = (() => {
    const seen = new Set<number>()
    let cum = 0
    return (dashboard?.projected_balance_by_quarter ?? []).map((row) => {
      if (!seen.has(row.year)) { seen.add(row.year); cum += simCostByYear[row.year] ?? 0 }
      return { ...row, adjustedBalance: row.balance - cum }
    })
  })()

  async function handleSaveSimulatie() {
    setSavingSimulatie(true)
    try {
      for (const post of simulatiePosts) {
        await api.post(`/vves/${vveId}/financial/mjop/items`, {
          description: post.description,
          planned_year: post.year,
          planned_amount: post.amount,
        })
      }
      setSimulatiePosts([])
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
    } finally {
      setSavingSimulatie(false)
    }
  }

  const hasShortfalls = (dashboard?.shortfalls?.length ?? 0) > 0
  const periodeLabel = dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'

  // Eigenaar: eigen bijdrage op basis van aandeel
  const eigenaarAandeel = user?.aandeel ? parseInt(user.aandeel) : null
  const eigenaarBijdrage =
    eigenaarAandeel && dashboard?.bijdrage_per_eenheid
      ? eigenaarAandeel * dashboard.bijdrage_per_eenheid
      : null
  const allChartData: ChartRow[] = granularity === 'kwartaal'
    ? toChartRows(adjQuarterly, true)
    : toChartRows(adjYearly, false)

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

      {/* Quick-info balk */}
      {(upcomingMeeting || (meldingStats && (meldingStats.nieuw + meldingStats.in_behandeling > 0))) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {upcomingMeeting && (
            <Link
              to="/meetings"
              className="flex items-center gap-3 bg-white border border-primary-200 hover:border-primary-400 rounded-xl px-4 py-3 transition-colors group"
            >
              <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                <CalendarDays size={18} className="text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Aankomende vergadering</p>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">
                  {upcomingMeeting.title}
                </p>
                <p className="text-xs text-primary-600">
                  {new Date(upcomingMeeting.meeting_date).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
            </Link>
          )}
          {meldingStats && (meldingStats.nieuw > 0 || meldingStats.spoed > 0) && (
            <Link
              to="/meldingen"
              className="flex items-center gap-3 bg-white border border-orange-200 hover:border-orange-400 rounded-xl px-4 py-3 transition-colors group"
            >
              <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                <Wrench size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Openstaande meldingen</p>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-700">
                  {meldingStats.nieuw} nieuw · {meldingStats.in_behandeling} in behandeling
                </p>
                {meldingStats.spoed > 0 && (
                  <p className="text-xs text-red-600 font-medium">{meldingStats.spoed} spoed</p>
                )}
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Aankondigingen */}
      {(announcements.length > 0 || isBeheerder) && (
        <div className="mb-6">
          {announcements.length > 0 && (
            <div className="space-y-3 mb-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className={`rounded-xl border px-5 py-4 flex items-start justify-between gap-4 ${
                    ann.is_pinned
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {ann.is_pinned ? (
                      <Pin size={15} className="text-primary-500 shrink-0 mt-0.5" />
                    ) : (
                      <Megaphone size={15} className="text-gray-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${ann.is_pinned ? 'text-primary-900' : 'text-gray-900'}`}>
                        {ann.title}
                      </p>
                      {ann.content && (
                        <p className={`text-sm mt-0.5 whitespace-pre-wrap ${ann.is_pinned ? 'text-primary-700' : 'text-gray-600'}`}>
                          {ann.content}
                        </p>
                      )}
                    </div>
                  </div>
                  {isBeheerder && (
                    <button
                      onClick={() => deleteAnn.mutate(ann.id)}
                      className="text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                      title="Verwijderen"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {isBeheerder && !showAnnForm && (
            <button
              onClick={() => setShowAnnForm(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-600 font-medium transition-colors"
            >
              <Plus size={12} /> Aankondiging plaatsen
            </button>
          )}
          {isBeheerder && showAnnForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <input
                type="text"
                value={annForm.title}
                onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="Titel aankondiging *"
                autoFocus
              />
              <textarea
                value={annForm.content}
                onChange={(e) => setAnnForm((f) => ({ ...f, content: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                placeholder="Berichttekst (optioneel)"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annForm.is_pinned}
                    onChange={(e) => setAnnForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                    className="accent-primary-600"
                  />
                  Vastpinnen bovenaan
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAnnForm(false); setAnnForm({ title: '', content: '', is_pinned: false }) }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
                  >
                    Annuleren
                  </button>
                  <button
                    disabled={!annForm.title || createAnn.isPending}
                    onClick={() => createAnn.mutate()}
                    className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Plaatsen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Eigenaar: persoonlijke bijdrage-card */}
      {!isBeheerder && eigenaarBijdrage != null && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary-700">Uw bijdrage aan het reservefonds</p>
            <p className="text-3xl font-bold text-primary-900 mt-1">{formatEurFull(eigenaarBijdrage)}</p>
            <p className="text-sm text-primary-600 mt-0.5">
              per {periodeLabel} — aandeel {eigenaarAandeel}/{dashboard?.share_denominator ?? '…'}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-primary-500 uppercase tracking-wider font-medium">Jaarlijks</p>
            <p className="text-xl font-semibold text-primary-800 mt-0.5">
              {formatEurFull(eigenaarBijdrage * (dashboard?.contribution_frequency === 'monthly' ? 12 : 4))}
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

      {/* Bijdrage per appartement (beheerder) */}
      {isBeheerder && (dashboard?.bijdrage_per_appartement?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <button
            onClick={() => setShowBijdrageTable((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Home size={16} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">Bijdrage per appartement</span>
              <span className="text-xs text-gray-400">
                ({dashboard!.bijdrage_per_appartement.length} eenheden)
              </span>
            </div>
            {showBijdrageTable
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showBijdrageTable && (
            <table className="w-full border-t border-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Appartement</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Eigenaar</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Aandeel</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Per {periodeLabel}
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Per jaar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboard!.bijdrage_per_appartement.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{a.naam}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{a.eigenaar_naam ?? '—'}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">
                      {a.aandeel}/{dashboard!.share_denominator}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      {formatEurFull(a.bijdrage_per_periode)}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">
                      {formatEurFull(a.bijdrage_per_periode * (dashboard?.contribution_frequency === 'monthly' ? 12 : 4))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-700">Totaal</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {formatEurFull(
                      dashboard!.bijdrage_per_appartement.reduce((s, a) => s + a.bijdrage_per_periode, 0)
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    {formatEurFull(
                      dashboard!.bijdrage_per_appartement.reduce((s, a) => s + a.bijdrage_per_periode, 0) *
                        (dashboard?.contribution_frequency === 'monthly' ? 12 : 4)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Gezond-indicator — alleen tonen als er MJOP-data is maar geen tekorten */}
      {chartData.length > 0 && !hasShortfalls && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500 shrink-0" size={20} />
            <div>
              <p className="font-medium text-green-800">Reservefonds is financieel gezond</p>
              <p className="text-sm text-green-700 mt-0.5">
                Geen tekorten verwacht op basis van het huidige MJOP en bijdrageplan.
              </p>
            </div>
          </div>
          {isBeheerder && (
            <button
              onClick={() => setShowSlimPlan(true)}
              className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Wand2 size={13} />
              Bereken slim plan
            </button>
          )}
        </div>
      )}

      {/* Balans-grafiek */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          {/* Header met filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900">Prognose reservefonds</h2>
              {isBeheerder && (
                <button
                  onClick={() => setShowSimForm(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 border border-orange-300 hover:border-orange-400 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Plus size={12} /> Simuleer extra kost
                </button>
              )}
              {isBeheerder && (
                <button
                  onClick={() => setShowSlimPlan(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-300 hover:border-indigo-400 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Wand2 size={12} /> Slim plan
                </button>
              )}
            </div>
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

              {/* Gesimuleerd saldo (oranje stippellijn) */}
              {simulatiePosts.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="adjustedBalance"
                  name="Saldo (simulatie)"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (!payload.isAdjustedShortfall) return <g key={payload.label} />
                    return <circle key={payload.label} cx={cx} cy={cy} r={5} fill="#ef4444" strokeWidth={0} />
                  }}
                />
              )}
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

      {/* Simulatie-banner */}
      {simulatiePosts.length > 0 && (
        <SimulatieBanner
          posts={simulatiePosts}
          adjYearly={adjYearly}
          origShortfallYears={new Set((dashboard?.shortfalls ?? []).map((s) => s.year))}
          onRemove={(id) => setSimulatiePosts((prev) => prev.filter((p) => p.id !== id))}
          onSaveAll={handleSaveSimulatie}
          saving={savingSimulatie}
        />
      )}

      {/* Simulatie-formulier modal */}
      {showSimForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold mb-4">Simuleer extra kost</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving *</label>
                <input
                  type="text"
                  value={simForm.description}
                  onChange={(e) => setSimForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  placeholder="bijv. Nieuw dak huis 73"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jaar *</label>
                <input
                  type="number"
                  value={simForm.year}
                  onChange={(e) => setSimForm((f) => ({ ...f, year: parseInt(e.target.value) || f.year }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  min={new Date().getFullYear()}
                  max={2060}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag (€) *</label>
                <input
                  type="number"
                  value={simForm.amount}
                  onChange={(e) => setSimForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  placeholder="bijv. 8500"
                  min={0}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowSimForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                disabled={!simForm.description || !simForm.amount || parseFloat(simForm.amount) <= 0}
                onClick={() => {
                  setSimulatiePosts((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), description: simForm.description, year: simForm.year, amount: parseFloat(simForm.amount) },
                  ])
                  setSimForm({ description: '', year: new Date().getFullYear(), amount: '' })
                  setShowSimForm(false)
                }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Toevoegen
              </button>
            </div>
          </div>
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
          {isBeheerder && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Wil je tekorten automatisch oplossen door dure posten te verschuiven?
              </p>
              <button
                onClick={() => setShowSlimPlan(true)}
                className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Wand2 size={14} />
                Bereken slim plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* Slim plan panel */}
      {showSlimPlan && isBeheerder && vveId && (
        <SlimPlanPanel
          vveId={vveId}
          onClose={() => setShowSlimPlan(false)}
          onAccepted={() => {
            setShowSlimPlan(false)
            qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
            qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
          }}
        />
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

function SimulatieBanner({
  posts, adjYearly, origShortfallYears, onRemove, onSaveAll, saving,
}: {
  posts: SimulatiePost[]
  adjYearly: AdjRow[]
  origShortfallYears: Set<number>
  onRemove: (id: string) => void
  onSaveAll: () => void
  saving: boolean
}) {
  const newShortfalls = adjYearly.filter((r) => r.adjustedBalance < 0 && r.balance >= 0)
  const worsenedYears = adjYearly.filter(
    (r) => r.adjustedBalance < 0 && r.balance < 0 && r.adjustedBalance < r.balance && origShortfallYears.has(r.year)
  )
  const totalSim = posts.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-orange-900 text-sm mb-2">
            Simulatie actief — {posts.length} tijdelijke post{posts.length === 1 ? '' : 'en'} ({formatEur(totalSim)} totaal)
          </p>
          <ul className="space-y-1.5 mb-3">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-orange-800">
                <span className="flex-1">{p.description} · {p.year} · {formatEur(p.amount)}</span>
                <button onClick={() => onRemove(p.id)} className="text-orange-400 hover:text-orange-600">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          {newShortfalls.length > 0 && (
            <p className="text-xs text-red-700 font-medium">
              Nieuwe tekorten in: {newShortfalls.map((r) => r.year).join(', ')}
            </p>
          )}
          {worsenedYears.length > 0 && newShortfalls.length === 0 && (
            <p className="text-xs text-orange-700">
              Bestaande tekorten worden vergroot in: {worsenedYears.map((r) => r.year).join(', ')}
            </p>
          )}
          {newShortfalls.length === 0 && worsenedYears.length === 0 && (
            <p className="text-xs text-green-700 font-medium">Geen nieuwe tekorten door deze simulatie</p>
          )}
        </div>
        <button
          onClick={onSaveAll}
          disabled={saving}
          className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Opslaan…' : 'Opslaan als MJOP-post'}
        </button>
      </div>
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

function SlimPlanPanel({ vveId, onClose, onAccepted }: {
  vveId: number
  onClose: () => void
  onAccepted: () => void
}) {
  const [maxShift, setMaxShift] = useState(4)
  const [accepting, setAccepting] = useState(false)

  const { data, isLoading } = useQuery<SmartPlanResult>({
    queryKey: ['slim-plan', vveId, maxShift],
    queryFn: () =>
      api.get(`/vves/${vveId}/financial/smart-plan?max_shift_quarters=${maxShift}`).then((r) => r.data),
    enabled: !!vveId,
  })

  async function handleAccept() {
    if (!data) return
    setAccepting(true)
    try {
      for (const shift of data.proposed_shifts) {
        await api.patch(`/vves/${vveId}/financial/mjop/items/${shift.item_id}`, {
          planned_year: shift.proposed_year,
          planned_quarter: shift.proposed_quarter,
        })
      }
      onAccepted()
    } finally {
      setAccepting(false)
    }
  }

  const chartData = (() => {
    if (!data) return []
    const allYears = new Set([
      ...data.original_cashflow.map((r) => r.year),
      ...data.new_cashflow.map((r) => r.year),
    ])
    const origMap = Object.fromEntries(data.original_cashflow.map((r) => [r.year, r.balance]))
    const newMap = Object.fromEntries(data.new_cashflow.map((r) => [r.year, r.balance]))
    return [...allYears].sort().map((year) => ({
      year: String(year),
      origineel: Math.round(origMap[year] ?? 0),
      nieuw: Math.round(newMap[year] ?? 0),
    }))
  })()

  return (
    <div className="bg-white border border-indigo-200 rounded-xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Wand2 size={16} className="text-indigo-600" />
            Slim plan — automatische verschuivingen
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Dure MJOP-posten worden verschoven naar nabijgelegen kwartalen om tekorten op te lossen
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
          <X size={18} />
        </button>
      </div>

      {/* Slider */}
      <div className="px-6 py-4 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maximale verschuiving:{' '}
          <span className="text-indigo-600 font-semibold">
            {maxShift} kwartaal{maxShift === 1 ? '' : 'en'} ({(maxShift / 4).toFixed(2).replace(/\.?0+$/, '')} jaar)
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={16}
          step={1}
          value={maxShift}
          onChange={(e) => setMaxShift(parseInt(e.target.value))}
          className="w-full max-w-sm accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400 max-w-sm mt-0.5">
          <span>1 kwartaal</span>
          <span>4 jaar</span>
        </div>
      </div>

      {isLoading && (
        <div className="px-6 py-10 text-center text-gray-400 text-sm">Berekenen…</div>
      )}

      {data && !isLoading && (
        <>
          {/* Resultaat-banner */}
          <div className={`px-6 py-3 border-b border-gray-100 ${data.shortfalls_resolved ? 'bg-green-50' : 'bg-amber-50'}`}>
            {data.shortfalls_resolved ? (
              <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                Alle tekorten worden opgelost met deze {data.proposed_shifts.length} verschuiving{data.proposed_shifts.length === 1 ? '' : 'en'}
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Tekorten deels opgelost — resterend in{' '}
                {data.shortfalls_remaining.map((s) => s.year).join(', ')}.
                Vergroot de maximale verschuiving voor een volledige oplossing.
              </p>
            )}
          </div>

          {/* Vergelijkingsgrafiek */}
          {chartData.length > 0 && (
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Saldo-vergelijking</h3>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 10, bottom: 4, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => `€${Math.abs(v / 1000).toFixed(0)}k${v < 0 ? '-' : ''}`}
                    tick={{ fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatEur(v), name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Line
                    type="monotone"
                    dataKey="origineel"
                    name="Huidig saldo"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="nieuw"
                    name="Saldo na verschuiving"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      if (payload.nieuw >= 0) return <g key={payload.year} />
                      return <circle key={payload.year} cx={cx} cy={cy} r={4} fill="#ef4444" strokeWidth={0} />
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Verschuivingen tabel */}
          {data.proposed_shifts.length > 0 ? (
            <div>
              <div className="px-6 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Voorgestelde verschuivingen ({data.proposed_shifts.length})
                </h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Post</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Bedrag</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Van</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-2.5">Naar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.proposed_shifts.map((shift) => (
                    <tr key={shift.item_id}>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {shift.description.length > 45
                          ? shift.description.slice(0, 42) + '…'
                          : shift.description}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-700">
                        {formatEur(shift.amount)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-500">
                        {shift.original_year}
                        {shift.original_quarter ? ` Q${shift.original_quarter}` : ''}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-indigo-700">
                        {shift.proposed_year}
                        {shift.proposed_quarter ? ` Q${shift.proposed_quarter}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-6 text-center text-sm text-gray-500">
              Geen verschuivingen nodig — het MJOP is al financieel haalbaar.
            </div>
          )}

          {/* Actieknoppen */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Annuleren
            </button>
            {data.proposed_shifts.length > 0 && (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle size={15} />
                {accepting
                  ? 'Verwerken…'
                  : `Accepteer ${data.proposed_shifts.length} verschuiving${data.proposed_shifts.length === 1 ? '' : 'en'}`}
              </button>
            )}
          </div>
        </>
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
