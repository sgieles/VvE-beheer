import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { FinancialDashboard, MJOPItem, VvE } from '@/types'
import { Printer, CheckCircle, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

function formatEur(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  planned: { label: 'Gepland', cls: 'bg-gray-100 text-gray-600' },
  quoted: { label: 'Offerte', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Goedgekeurd', cls: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Afgerond', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Geannuleerd', cls: 'bg-gray-100 text-gray-400' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

export default function RapportPage() {
  const { activeVveId } = useAuthStore()
  const vveId = activeVveId
  const today = format(new Date(), 'd MMMM yyyy', { locale: nl })

  const { data: vve } = useQuery<VvE>({
    queryKey: ['vve', vveId],
    queryFn: () => api.get(`/vves/${vveId}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: dashboard } = useQuery<FinancialDashboard>({
    queryKey: ['dashboard', vveId, 0],
    queryFn: () =>
      api.get(`/vves/${vveId}/financial/dashboard?inflatie=0`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: allItems = [] } = useQuery<MJOPItem[]>({
    queryKey: ['mjop-items', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/mjop/items`).then((r) => r.data),
    enabled: !!vveId,
  })

  const activeItems = allItems.filter((i) => i.status !== 'cancelled')
  const totalGepland = activeItems.reduce((s, i) => s + parseFloat(i.planned_amount), 0)

  const byYear = activeItems.reduce<Record<number, MJOPItem[]>>((acc, item) => {
    const y = item.planned_year
    if (!acc[y]) acc[y] = []
    acc[y].push(item)
    return acc
  }, {})
  const sortedYears = Object.keys(byYear).map(Number).sort()

  const hasShortfalls = (dashboard?.shortfalls?.length ?? 0) > 0
  const periodeLabel = dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'
  let sectionIdx = 0
  const nextSection = () => (++sectionIdx).toString()

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Toolbar — verborgen bij afdrukken */}
      <div className="print:hidden bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Financieel rapport</h1>
          <p className="text-sm text-gray-500">{vve?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{today}</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Printer size={15} />
            Afdrukken / PDF
          </button>
        </div>
      </div>

      {/* Rapport-inhoud */}
      <div className="max-w-4xl mx-auto px-8 py-10 print:px-6 print:py-6 print:max-w-full">

        {/* Koptekst */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Financieel rapport</h1>
              <p className="text-xl text-gray-700 mt-0.5">{vve?.name}</p>
              {vve?.address && <p className="text-sm text-gray-500 mt-1">{vve.address}</p>}
              {vve?.kvk_number && (
                <p className="text-sm text-gray-400">KvK: {vve.kvk_number}</p>
              )}
            </div>
            <div className="text-right text-sm text-gray-400">
              <p>Rapportdatum</p>
              <p className="font-medium text-gray-700">{today}</p>
            </div>
          </div>
          <hr className="mt-5 border-gray-300" />
        </div>

        {/* 1. Reservefonds overzicht */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            {nextSection()}. Reservefonds overzicht
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Huidig saldo', value: dashboard ? formatEur(dashboard.current_reservefonds_balance) : '—' },
              { label: `Bijdrage / ${periodeLabel}`, value: dashboard ? formatEur(dashboard.current_contribution_per_period) : '—' },
              { label: 'Kosten (5 jaar)', value: dashboard ? formatEur(dashboard.total_planned_costs_next_5_years) : '—' },
              { label: 'Kosten (10 jaar)', value: dashboard ? formatEur(dashboard.total_planned_costs_next_10_years) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className={`rounded-xl border p-4 ${hasShortfalls ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2">
              {hasShortfalls
                ? <AlertTriangle size={15} className="text-red-500 shrink-0" />
                : <CheckCircle size={15} className="text-green-500 shrink-0" />}
              <p className={`text-sm font-medium ${hasShortfalls ? 'text-red-800' : 'text-green-800'}`}>
                {hasShortfalls
                  ? `Financieel tekort verwacht in: ${dashboard?.shortfalls.map((s) => s.year).join(', ')}`
                  : 'Geen tekorten verwacht op basis van het huidige MJOP en bijdrageplan'}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Prognose tabel */}
        {(dashboard?.projected_balance_by_year?.length ?? 0) > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {nextSection()}. Prognose reservefonds (komende 10 jaar)
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Jaar', 'Bijdragen', 'Kosten', 'Saldo eind jaar'].map((h, i) => (
                      <th key={h} className={`text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboard!.projected_balance_by_year.slice(0, 10).map((row) => {
                    const isShortfall = row.balance < 0
                    return (
                      <tr key={row.year} className={isShortfall ? 'bg-red-50/40' : ''}>
                        <td className={`px-4 py-2 font-medium ${isShortfall ? 'text-red-700' : 'text-gray-900'}`}>
                          {row.year}
                        </td>
                        <td className="px-4 py-2 text-right text-green-700">{formatEur(row.contributions)}</td>
                        <td className="px-4 py-2 text-right text-orange-700">
                          {row.costs > 0 ? formatEur(row.costs) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold ${isShortfall ? 'text-red-700' : 'text-gray-900'}`}>
                          {formatEur(row.balance)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. MJOP onderhoudsbegroting */}
        {sortedYears.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {nextSection()}. MJOP — onderhoudsbegroting
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Omschrijving', 'Categorie', 'Begroot', 'Werkelijk', 'Status'].map((h, i) => (
                      <th key={h} className={`text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 ${i < 2 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedYears.flatMap((year) => {
                    const items = byYear[year]
                    const yearTotal = items.reduce((s, i) => s + parseFloat(i.planned_amount), 0)
                    return [
                      <tr key={`yr-${year}`} className="bg-gray-50 border-t border-b border-gray-200">
                        <td colSpan={2} className="px-4 py-2 font-bold text-gray-800 text-xs uppercase tracking-wide">
                          {year}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-gray-800 text-xs">
                          {formatEur(yearTotal)}
                        </td>
                        <td colSpan={2} className="px-4 py-2" />
                      </tr>,
                      ...items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="px-4 py-2 text-gray-900 pl-8">
                            {item.description.length > 52 ? item.description.slice(0, 49) + '…' : item.description}
                            {item.planned_quarter && (
                              <span className="text-gray-400 text-xs ml-1">Q{item.planned_quarter}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-500 capitalize">{item.category ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {formatEur(parseFloat(item.planned_amount))}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {item.actual_amount ? (
                              <span className={parseFloat(item.actual_amount) > parseFloat(item.planned_amount) ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                                {formatEur(parseFloat(item.actual_amount))}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      )),
                    ]
                  })}
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">Totaal gepland</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatEur(totalGepland)}</td>
                    <td colSpan={2} className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. Tekortanalyse */}
        {hasShortfalls && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {nextSection()}. Tekortanalyse
            </h2>
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-200">
                  <tr>
                    {['Jaar', 'Bijdragen', 'Kosten', 'Saldo', 'Tekort'].map((h, i) => (
                      <th key={h} className={`text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {dashboard!.shortfalls.map((s) => {
                    const row = dashboard!.projected_balance_by_year.find((r) => r.year === s.year)
                    return (
                      <tr key={s.year} className="bg-red-50/30">
                        <td className="px-4 py-2 font-medium text-red-700">{s.year}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row ? formatEur(row.contributions) : '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row ? formatEur(row.costs) : '—'}</td>
                        <td className="px-4 py-2 text-right text-red-600 font-medium">{row ? formatEur(row.balance) : '—'}</td>
                        <td className="px-4 py-2 text-right font-bold text-red-700">{formatEur(s.shortfall)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. Bijdrage per appartement */}
        {(dashboard?.bijdrage_per_appartement?.length ?? 0) > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {nextSection()}. Bijdrage per appartement
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Appartement', 'Eigenaar', 'Aandeel', `Per ${periodeLabel}`, 'Per jaar'].map((h, i) => (
                      <th key={h} className={`text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 ${i < 2 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboard!.bijdrage_per_appartement.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">{a.naam}</td>
                      <td className="px-4 py-2 text-gray-500">{a.eigenaar_naam ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {a.aandeel}/{dashboard!.share_denominator}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {formatEur(a.bijdrage_per_periode)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {formatEur(
                          a.bijdrage_per_periode * (dashboard?.contribution_frequency === 'monthly' ? 12 : 4)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-bold text-gray-900">Totaal</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatEur(
                        dashboard!.bijdrage_per_appartement.reduce((s, a) => s + a.bijdrage_per_periode, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                      {formatEur(
                        dashboard!.bijdrage_per_appartement.reduce((s, a) => s + a.bijdrage_per_periode, 0) *
                          (dashboard?.contribution_frequency === 'monthly' ? 12 : 4)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-gray-200 text-xs text-gray-400 text-center">
          Gegenereerd op {today} · VvE Beheer Platform
        </div>
      </div>
    </div>
  )
}
