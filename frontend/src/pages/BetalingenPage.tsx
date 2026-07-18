import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { ContributionPayment, PaymentSummary, Appartement, VvE } from '@/types'
import { Check, AlertCircle, RefreshCw, Euro, Clock, TrendingUp, MessageSquare, X, Download } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { toast } from '@/store/toastStore'
import { apiError } from '@/utils/apiError'

function formatEur(v: number | string) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v))
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
const QUARTER_SHORT = ['K1', 'K2', 'K3', 'K4']

function periodLabel(period: number, frequency: string): string {
  return frequency === 'monthly' ? MONTH_SHORT[period - 1] : QUARTER_SHORT[period - 1]
}

function periodEnd(year: number, period: number, frequency: string): Date {
  if (frequency === 'monthly') {
    return period === 12 ? new Date(year, 11, 31) : new Date(year, period, 0)
  }
  const ends = [new Date(year, 2, 31), new Date(year, 5, 30), new Date(year, 8, 30), new Date(year, 11, 31)]
  return ends[period - 1]
}

export default function BetalingenPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const { data: vve } = useQuery<VvE>({
    queryKey: ['vve', vveId],
    queryFn: () => api.get(`/vves/${vveId}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: appartementen = [] } = useQuery<Appartement[]>({
    queryKey: ['appartementen', vveId],
    queryFn: () => api.get(`/vves/${vveId}/appartementen`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: payments = [], isLoading } = useQuery<ContributionPayment[]>({
    queryKey: ['payments', vveId, year],
    queryFn: () => api.get(`/vves/${vveId}/payments?year=${year}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: summary } = useQuery<PaymentSummary>({
    queryKey: ['payments-summary', vveId, year],
    queryFn: () => api.get(`/vves/${vveId}/payments/summary?year=${year}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const generatePayments = useMutation({
    mutationFn: () => api.post(`/vves/${vveId}/payments/generate?year=${year}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', vveId, year] })
      qc.invalidateQueries({ queryKey: ['payments-summary', vveId, year] })
      toast('Betaalrecords aangemaakt')
    },
    onError: (err) => toast(apiError(err, 'Genereren mislukt')),
  })

  const updatePayment = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) =>
      api.patch(`/vves/${vveId}/payments/${id}`, { paid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', vveId, year] })
      qc.invalidateQueries({ queryKey: ['payments-summary', vveId, year] })
    },
    onError: (err) => toast(apiError(err, 'Betaalstatus bijwerken mislukt')),
  })

  const [notitiesApp, setNotitiesApp] = useState<Appartement | null>(null)

  const frequency = vve?.contribution_frequency ?? 'monthly'
  const numPeriods = frequency === 'monthly' ? 12 : 4
  const periods = Array.from({ length: numPeriods }, (_, i) => i + 1)
  const today = new Date()

  // Group payments by appartement_id + period_period
  const paymentMap: Record<string, ContributionPayment> = {}
  for (const p of payments) {
    paymentMap[`${p.appartement_id}-${p.period_period}`] = p
  }

  const activeApps = appartementen.filter((a) => a.is_active)

  const getCellState = (appId: number, period: number) => {
    const key = `${appId}-${period}`
    const p = paymentMap[key]
    if (!p) return 'missing'
    if (p.paid_at) return 'paid'
    const end = periodEnd(year, period, frequency)
    if (end < today) return 'overdue'
    return 'pending'
  }

  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 7 + i)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Betalingsbeheer</h1>
          <p className="text-gray-500 mt-1">Bijdragen per appartement bijhouden</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {isBeheerder && (
            <button
              onClick={() => generatePayments.mutate()}
              disabled={generatePayments.isPending}
              className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={generatePayments.isPending ? 'animate-spin' : ''} />
              Genereer {year}
            </button>
          )}
        </div>
      </div>

      {/* KPI samenvatting */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Totaal verwacht',
              value: formatEur(summary.total_expected),
              icon: Euro,
              cls: 'text-gray-700',
              bg: 'bg-white border-gray-200',
            },
            {
              label: 'Ontvangen',
              value: formatEur(summary.total_paid),
              icon: Check,
              cls: 'text-green-700',
              bg: 'bg-green-50 border-green-200',
            },
            {
              label: 'Achterstallig',
              value: formatEur(summary.overdue),
              icon: AlertCircle,
              cls: 'text-red-700',
              bg: summary.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200',
            },
            {
              label: 'Betaalpercentage',
              value: `${summary.pct_paid}%`,
              icon: TrendingUp,
              cls: summary.pct_paid >= 90 ? 'text-green-700' : summary.pct_paid >= 60 ? 'text-amber-600' : 'text-red-700',
              bg: 'bg-white border-gray-200',
            },
          ].map(({ label, value, icon: Icon, cls, bg }) => (
            <div key={label} className={`border rounded-xl p-4 ${bg}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <Icon size={14} className={cls} />
              </div>
              <p className={`text-xl font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Achterstallige betalers */}
      {isBeheerder && summary && summary.overdue > 0 && payments.length > 0 && (() => {
        const overdueApps = activeApps.filter((app) =>
          periods.some((p) => getCellState(app.id, p) === 'overdue')
        ).map((app) => ({
          ...app,
          overdueCount: periods.filter((p) => getCellState(app.id, p) === 'overdue').length,
          overdueAmount: periods
            .filter((p) => getCellState(app.id, p) === 'overdue')
            .reduce((s, p) => {
              const payment = paymentMap[`${app.id}-${p}`]
              return s + (payment ? Number(payment.expected_amount) : 0)
            }, 0),
        }))

        function exportOverdue() {
          const rows = [
            'Appartement,Eigenaar,Achterstallige periodes,Achterstallig bedrag',
            ...overdueApps.map((a) => `"${a.naam}","${a.eigenaar_naam ?? ''}",${a.overdueCount},${a.overdueAmount.toFixed(2)}`),
          ]
          const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a'); link.href = url; link.download = `achterstalligen_${year}.csv`; link.click()
          URL.revokeObjectURL(url)
        }

        return (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span className="text-sm font-semibold text-red-800">
                  {overdueApps.length} appartement{overdueApps.length !== 1 ? 'en' : ''} met achterstallige betalingen
                </span>
              </div>
              <button
                onClick={exportOverdue}
                className="flex items-center gap-1.5 text-xs text-red-700 hover:text-red-800 border border-red-300 px-2.5 py-1.5 rounded-lg font-medium"
              >
                <Download size={12} />
                Exporteer CSV
              </button>
            </div>
            <div className="space-y-1">
              {overdueApps.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm text-red-800">
                  <span className="font-medium">{a.naam}{a.eigenaar_naam ? ` — ${a.eigenaar_naam}` : ''}</span>
                  <span className="text-red-600 text-xs">
                    {a.overdueCount} periode{a.overdueCount !== 1 ? 's' : ''} · {formatEur(a.overdueAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Legenda */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-green-500 inline-block" /> Betaald
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-400 inline-block" /> Achterstallig
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-gray-100 border border-gray-300 inline-block" /> Verwacht
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-gray-200 inline-block" /> Geen record
        </span>
      </div>

      {isLoading && <div className="text-gray-500 text-sm">Laden...</div>}

      {payments.length === 0 && !isLoading && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Clock className="mx-auto text-gray-400 mb-3" size={32} />
          <p className="text-gray-700 font-medium mb-1">Geen betalingsrecords voor {year}</p>
          {isBeheerder ? (
            <p className="text-gray-500 text-sm">
              Klik op <strong>"Genereer {year}"</strong> om betaalrecords aan te maken voor alle actieve appartementen.
            </p>
          ) : (
            <p className="text-gray-500 text-sm">De beheerder heeft nog geen betalingsrecords aangemaakt voor {year}.</p>
          )}
        </div>
      )}

      {payments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 sticky left-0 bg-gray-50 z-10">
                  Appartement
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3 whitespace-nowrap">
                  Bijdrage
                </th>
                {periods.map((p) => (
                  <th key={p} className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-3 min-w-[44px]">
                    {periodLabel(p, frequency)}
                  </th>
                ))}
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Betaald
                </th>
                {isBeheerder && <th className="px-2 py-3 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeApps.map((app) => {
                const appPayments = payments.filter((p) => p.appartement_id === app.id)
                const paidCount = appPayments.filter((p) => p.paid_at).length
                const totalPaid = appPayments.reduce((s, p) => s + (p.paid_at ? Number(p.paid_amount ?? p.expected_amount) : 0), 0)
                const samplePayment = appPayments[0]
                const expectedPerPeriod = samplePayment ? Number(samplePayment.expected_amount) : 0

                return (
                  <tr key={app.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50/50 z-10">
                      <div className="whitespace-nowrap">
                        {app.naam}
                        {app.eigenaar_naam && (
                          <p className="text-xs text-gray-400 font-normal">{app.eigenaar_naam}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                      {expectedPerPeriod > 0 ? formatEur(expectedPerPeriod) : '—'}
                    </td>
                    {periods.map((period) => {
                      const key = `${app.id}-${period}`
                      const payment = paymentMap[key]
                      const state = getCellState(app.id, period)

                      if (state === 'missing') {
                        return (
                          <td key={period} className="px-2 py-3 text-center">
                            <span className="inline-block w-7 h-7 rounded bg-gray-100 border border-gray-200" />
                          </td>
                        )
                      }

                      return (
                        <td key={period} className="px-2 py-3 text-center">
                          {isBeheerder ? (
                            <button
                              onClick={() => payment && updatePayment.mutate({ id: payment.id, paid: !payment.paid_at })}
                              title={
                                state === 'paid'
                                  ? `Betaald op ${payment?.paid_at ? format(new Date(payment.paid_at), 'd MMM yyyy', { locale: nl }) : '?'} — klik om te markeren als onbetaald`
                                  : `Markeer als betaald`
                              }
                              className={`inline-flex items-center justify-center w-9 h-9 sm:w-7 sm:h-7 rounded transition-colors ${
                                state === 'paid'
                                  ? 'bg-green-500 hover:bg-green-600'
                                  : state === 'overdue'
                                  ? 'bg-red-100 border border-red-300 hover:bg-red-200'
                                  : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
                              }`}
                            >
                              {state === 'paid' && <Check size={13} className="text-white" />}
                              {state === 'overdue' && <AlertCircle size={12} className="text-red-500" />}
                            </button>
                          ) : (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded ${
                              state === 'paid'
                                ? 'bg-green-500'
                                : state === 'overdue'
                                ? 'bg-red-100 border border-red-300'
                                : 'bg-gray-100 border border-gray-300'
                            }`}>
                              {state === 'paid' && <Check size={13} className="text-white" />}
                              {state === 'overdue' && <AlertCircle size={12} className="text-red-500" />}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${paidCount === numPeriods ? 'text-green-700' : paidCount === 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                        {paidCount}/{numPeriods}
                      </span>
                      {totalPaid > 0 && (
                        <p className="text-xs text-gray-400">{formatEur(totalPaid)}</p>
                      )}
                    </td>
                    {isBeheerder && (
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => setNotitiesApp(app)}
                          title="Notities"
                          className={`p-1 rounded transition-colors ${
                            appPayments.some((p) => p.notes)
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                        >
                          <MessageSquare size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            {/* Totaalrij */}
            {summary && (
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td className="px-4 py-3 font-bold text-gray-900 sticky left-0 bg-gray-50 z-10">Totaal</td>
                  <td className="px-3 py-3 text-gray-700 font-medium">
                    {payments.length > 0 ? formatEur(
                      activeApps.reduce((sum, app) => {
                        const p = payments.find((pay) => pay.appartement_id === app.id)
                        return sum + (p ? Number(p.expected_amount) : 0)
                      }, 0)
                    ) : '—'}
                  </td>
                  {periods.map((period) => {
                    const periodPayments = payments.filter((p) => p.period_period === period)
                    const paidThisPeriod = periodPayments.filter((p) => p.paid_at).length
                    const totalThisPeriod = periodPayments.length
                    return (
                      <td key={period} className="px-2 py-3 text-center">
                        <span className={`text-xs font-medium ${paidThisPeriod === totalThisPeriod && totalThisPeriod > 0 ? 'text-green-600' : paidThisPeriod === 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                          {paidThisPeriod}/{totalThisPeriod}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-gray-900">{formatEur(summary.total_paid)}</span>
                    <p className="text-xs text-gray-500">{summary.pct_paid}%</p>
                  </td>
                  {isBeheerder && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {notitiesApp && (
        <NotitiesModal
          app={notitiesApp}
          payments={payments.filter((p) => p.appartement_id === notitiesApp.id)}
          vveId={vveId!}
          frequency={frequency}
          onClose={() => setNotitiesApp(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['payments', vveId, year] })}
        />
      )}
    </div>
  )
}

function NotitiesModal({ app, payments, vveId, frequency, onClose, onSaved }: {
  app: Appartement
  payments: ContributionPayment[]
  vveId: number
  frequency: string
  onClose: () => void
  onSaved: () => void
}) {
  const [notes, setNotes] = useState<Record<number, string>>(
    Object.fromEntries(payments.map((p) => [p.id, p.notes ?? '']))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const changed = payments.filter((p) => (notes[p.id] ?? '') !== (p.notes ?? ''))
    await Promise.all(
      changed.map((p) => api.patch(`/vves/${vveId}/payments/${p.id}`, { notes: notes[p.id] || null }))
    )
    setSaving(false)
    onSaved()
    toast('Notities opgeslagen')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Notities</h2>
            <p className="text-sm text-gray-500">{app.naam}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {payments.length === 0 && (
            <p className="text-sm text-gray-400">Geen betaalrecords voor dit appartement.</p>
          )}
          {payments.map((p) => (
            <div key={p.id}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {periodLabel(p.period_period, frequency)}
                {p.paid_at && <span className="ml-1 text-green-600">✓ betaald</span>}
              </label>
              <textarea
                rows={2}
                value={notes[p.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                placeholder="Interne notitie (optioneel)..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50"
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
