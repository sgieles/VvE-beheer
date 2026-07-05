import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { FinancialDashboard, MJOPItem, ContributionPlan, ReserveFondsEntry } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Upload, Plus, Pencil, CheckCircle, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

function formatEur(v: number | string) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v))
}

const TABS = ['Dashboard', 'MJOP', 'Reservefonds', 'Bijdragen'] as const
type Tab = typeof TABS[number]

export default function FinancialPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const [tab, setTab] = useState<Tab>('Dashboard')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Financieel</h1>
        <p className="text-gray-500 mt-1">MJOP, reservefonds en scenarioplanning</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-8">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && <DashboardTab vveId={vveId!} isBeheerder={isBeheerder} />}
      {tab === 'MJOP' && <MJOPTab vveId={vveId!} isBeheerder={isBeheerder} />}
      {tab === 'Reservefonds' && <ReserveFondsTab vveId={vveId!} isBeheerder={isBeheerder} />}
      {tab === 'Bijdragen' && <BijdragenTab vveId={vveId!} isBeheerder={isBeheerder} />}
    </div>
  )
}

// --- Dashboard tab ---
function DashboardTab({ vveId, isBeheerder }: { vveId: number; isBeheerder: boolean }) {
  const { data: dashboard, isLoading } = useQuery<FinancialDashboard>({
    queryKey: ['dashboard', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/dashboard`).then((r) => r.data),
    enabled: !!vveId,
  })

  if (isLoading) return <div className="text-gray-500">Laden...</div>
  if (!dashboard) return <div className="text-gray-500">Geen data beschikbaar. Upload eerst een MJOP en voer een reservefonds saldo in.</div>

  const chartData = dashboard.projected_balance_by_year.map((row) => ({
    ...row,
    balance: Math.round(row.balance),
    costs: Math.round(row.costs),
    contributions: Math.round(row.contributions),
  }))

  return (
    <div className="space-y-8">
      {/* KPI's */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500">Huidig reservefonds</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatEur(dashboard.current_reservefonds_balance)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500">Kosten komende 5 jaar</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatEur(dashboard.total_planned_costs_next_5_years)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500">Kosten komende 10 jaar</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatEur(dashboard.total_planned_costs_next_10_years)}</p>
        </div>
      </div>

      {/* Grafiek */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Prognose reservefonds</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => formatEur(v)} labelFormatter={(l) => `Jaar ${l}`} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="balance" stroke="#3b82f6" fill="url(#balanceGrad)" strokeWidth={2} name="Saldo" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario's */}
      {dashboard.scenarios.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Scenario's om tekort op te lossen
          </h2>
          {dashboard.shortfalls.length > 0 && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-4 py-3 mb-4">
              <AlertTriangle size={16} />
              <span className="text-sm">Tekort gedetecteerd in: {dashboard.shortfalls.map((s) => s.year).join(', ')}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard.scenarios.map((s) => (
              <ScenarioCard key={s.scenario_type} scenario={s} isBeheerder={isBeheerder} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScenarioCard({ scenario, isBeheerder }: { scenario: FinancialDashboard['scenarios'][0]; isBeheerder: boolean }) {
  const typeLabel: Record<string, string> = {
    contribution_increase: 'Bijdrage verhogen',
    defer_activity: 'Activiteiten verschuiven',
    one_time_levy: 'Eenmalige bijdrage',
  }
  const typeColor: Record<string, string> = {
    contribution_increase: 'border-blue-200 bg-blue-50',
    defer_activity: 'border-yellow-200 bg-yellow-50',
    one_time_levy: 'border-purple-200 bg-purple-50',
  }

  return (
    <div className={`border rounded-xl p-5 ${typeColor[scenario.scenario_type] ?? 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-gray-600" />
        <span className="text-sm font-semibold text-gray-700">{typeLabel[scenario.scenario_type]}</span>
      </div>
      <p className="text-sm text-gray-600 mb-4">{scenario.description}</p>

      {scenario.scenario_type === 'contribution_increase' && (
        <div className="text-sm space-y-1">
          <p><span className="text-gray-500">Nieuwe bijdrage:</span> <span className="font-medium">{formatEur(scenario.new_contribution_per_period as number)}</span></p>
          <p><span className="text-gray-500">Verhoging:</span> <span className="font-medium text-amber-700">+ {formatEur(scenario.increase_per_period as number)}</span></p>
        </div>
      )}
      {scenario.scenario_type === 'one_time_levy' && (
        <div className="text-sm space-y-1">
          <p><span className="text-gray-500">Totaal benodigd:</span> <span className="font-medium">{formatEur(scenario.total_levy as number)}</span></p>
          <p><span className="text-gray-500">Per aandeel:</span> <span className="font-medium text-purple-700">{formatEur(scenario.levy_per_full_aandeel as number)}</span></p>
        </div>
      )}
      {scenario.scenario_type === 'defer_activity' && (
        <div className="text-sm">
          <p className="text-gray-500 mb-1">Verschuiven:</p>
          {(scenario.suggested_deferrals as Array<{ description: string; original_year: number; proposed_year: number }>).slice(0, 3).map((d, i) => (
            <p key={i} className="text-gray-700 flex items-center gap-1">
              <ArrowRight size={12} /> {d.description}: {d.original_year} <ArrowRight size={12} /> {d.proposed_year}
            </p>
          ))}
        </div>
      )}

      {isBeheerder && (
        <button className="mt-4 w-full text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 rounded-lg transition-colors font-medium">
          Scenario kiezen
        </button>
      )}
    </div>
  )
}

// --- MJOP tab ---
function MJOPTab({ vveId, isBeheerder }: { vveId: number; isBeheerder: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editItem, setEditItem] = useState<MJOPItem | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: items = [], isLoading } = useQuery<MJOPItem[]>({
    queryKey: ['mjop-items', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/mjop/items`).then((r) => r.data),
    enabled: !!vveId,
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/vves/${vveId}/financial/mjop/upload`, form)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
        qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
        setUploading(false)
      }, 2000)
    } catch {
      setUploading(false)
    }
    e.target.value = ''
  }

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MJOPItem> }) =>
      api.patch(`/vves/${vveId}/financial/mjop/items/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setEditItem(null)
    },
  })

  const groupedByYear = items.reduce<Record<number, MJOPItem[]>>((acc, item) => {
    const y = item.planned_year
    if (!acc[y]) acc[y] = []
    acc[y].push(item)
    return acc
  }, {})

  const statusColors: Record<string, string> = {
    planned: 'bg-gray-100 text-gray-600',
    quoted: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    completed: 'bg-gray-200 text-gray-500',
  }

  return (
    <div className="space-y-6">
      {isBeheerder && (
        <div className="flex gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.pdf" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Upload size={16} />
            {uploading ? 'Verwerken...' : 'MJOP uploaden (Excel/PDF)'}
          </button>
        </div>
      )}

      {isLoading && <div className="text-gray-500">Laden...</div>}

      {!isLoading && items.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Upload className="mx-auto text-gray-400 mb-3" size={32} />
          <p className="text-gray-500">Nog geen MJOP geladen. Upload een Excel- of PDF-bestand.</p>
        </div>
      )}

      {Object.entries(groupedByYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, yearItems]) => (
        <div key={year} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{year}</h3>
            <span className="text-sm text-gray-500">
              {formatEur(yearItems.reduce((s, i) => s + parseFloat(i.planned_amount), 0))} begroot
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Omschrijving', 'Categorie', 'Kwartaal', 'Begroot', 'Werkelijk', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-xs text-gray-500 px-6 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {yearItems.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 ${item.manually_adjusted ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-6 py-3 text-sm text-gray-900">{item.description}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{item.category ?? '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{item.planned_quarter ? `Q${item.planned_quarter}` : 'Heel jaar'}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{formatEur(item.planned_amount)}</td>
                  <td className="px-6 py-3 text-sm">
                    {item.actual_amount
                      ? <span className={parseFloat(item.actual_amount) > parseFloat(item.planned_amount) ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          {formatEur(item.actual_amount)}
                        </span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {isBeheerder && (
                      <button onClick={() => setEditItem(item)} className="text-gray-400 hover:text-primary-600">
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {editItem && (
        <MJOPItemEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => updateItem.mutate({ id: editItem.id, data })}
        />
      )}
    </div>
  )
}

function MJOPItemEditModal({ item, onClose, onSave }: {
  item: MJOPItem; onClose: () => void; onSave: (data: Partial<MJOPItem>) => void
}) {
  const [year, setYear] = useState(item.planned_year.toString())
  const [quarter, setQuarter] = useState(item.planned_quarter?.toString() ?? '')
  const [amount, setAmount] = useState(item.planned_amount)
  const [actual, setActual] = useState(item.actual_amount ?? '')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">Post bewerken</h2>
        <p className="text-sm text-gray-500 mb-4">{item.description}</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jaar *</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kwartaal</label>
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">Heel jaar</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Begroot bedrag (€)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Werkelijk (€)</label>
              <input type="number" value={actual} onChange={(e) => setActual(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="Leeg = niet ingevoerd" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            Annuleren
          </button>
          <button
            onClick={() => onSave({
              planned_year: parseInt(year),
              planned_quarter: quarter ? parseInt(quarter) : undefined,
              planned_amount: amount as unknown as string,
              actual_amount: actual || undefined,
            })}
            className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Reservefonds tab ---
function ReserveFondsTab({ vveId, isBeheerder }: { vveId: number; isBeheerder: boolean }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entry_date: '', amount: '', description: '' })

  // Balanssheet upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<'select' | 'confirm'>('select')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadParsed, setUploadParsed] = useState<{ amount: number | null; entry_date: string | null; confidence: string } | null>(null)
  const [uploadConfirm, setUploadConfirm] = useState({ entry_date: '', amount: '', description: 'Openingssaldo (bankbalans)' })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: entries = [] } = useQuery<ReserveFondsEntry[]>({
    queryKey: ['reservefonds', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/reservefonds`).then((r) => r.data),
    enabled: !!vveId,
  })

  const addEntry = useMutation({
    mutationFn: (data: typeof form) => api.post(`/vves/${vveId}/financial/reservefonds`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservefonds', vveId] }); qc.invalidateQueries({ queryKey: ['dashboard', vveId] }); setShowForm(false) },
  })

  async function handleBalansUpload() {
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      const res = await api.post(`/vves/${vveId}/financial/balanssheet/upload`, fd)
      setUploadParsed(res.data)
      setUploadConfirm({
        entry_date: res.data.entry_date ?? '',
        amount: res.data.amount != null ? String(Math.round(res.data.amount)) : '',
        description: 'Openingssaldo (bankbalans)',
      })
      setUploadPhase('confirm')
    } catch {
      setUploadError('Het bestand kon niet worden verwerkt. Controleer het bestandstype en probeer opnieuw.')
    } finally {
      setUploading(false)
    }
  }

  async function handleBalansConfirm() {
    await api.post(`/vves/${vveId}/financial/reservefonds`, uploadConfirm)
    qc.invalidateQueries({ queryKey: ['reservefonds', vveId] })
    qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
    setShowUpload(false)
    setUploadPhase('select')
    setUploadFile(null)
    setUploadParsed(null)
  }

  const balance = entries.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Huidig saldo reservefonds</p>
          <p className={`text-3xl font-bold mt-1 ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatEur(balance)}</p>
        </div>
        {isBeheerder && (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowUpload(true); setUploadPhase('select'); setUploadFile(null); setUploadError(null) }}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2.5 rounded-lg"
            >
              <Upload size={15} /> Bankbalans importeren
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
              <Plus size={16} /> Mutatie toevoegen
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Datum', 'Omschrijving', 'Bedrag'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">Nog geen mutaties ingevoerd</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-600">{format(new Date(e.entry_date), 'd MMM yyyy', { locale: nl })}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{e.description ?? '—'}</td>
                <td className={`px-6 py-3 text-sm font-medium ${parseFloat(e.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(e.amount) >= 0 ? '+' : ''}{formatEur(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Bankbalans importeren</h2>
            {uploadPhase === 'select' ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Upload een PDF of Excel met het actuele banksaldo. Het systeem probeert de datum en het saldo automatisch te herkennen.
                </p>
                {uploadError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{uploadError}</div>
                )}
                <label htmlFor="balans-file" className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
                  <Upload size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">
                    {uploadFile ? uploadFile.name : 'Klik om een bestand te selecteren'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF of Excel</p>
                  <input id="balans-file" type="file" accept=".pdf,.xlsx,.xls" className="hidden"
                    onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setUploadError(null) }} />
                </label>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowUpload(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
                  <button onClick={handleBalansUpload} disabled={!uploadFile || uploading}
                    className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50">
                    {uploading ? 'Analyseren…' : 'Analyseren'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {uploadParsed?.confidence === 'low' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
                    Saldo en/of datum konden niet automatisch worden herkend. Controleer de waarden voor u opslaat.
                  </div>
                )}
                {uploadParsed?.confidence === 'high' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-700">
                    Datum en saldo succesvol herkend. Controleer de waarden en sla op.
                  </div>
                )}
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Balansdatum *</label>
                    <input type="date" value={uploadConfirm.entry_date}
                      onChange={(e) => setUploadConfirm((f) => ({ ...f, entry_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saldo (€) *</label>
                    <input type="number" value={uploadConfirm.amount}
                      onChange={(e) => setUploadConfirm((f) => ({ ...f, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      placeholder="bijv. 45000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                    <input type="text" value={uploadConfirm.description}
                      onChange={(e) => setUploadConfirm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setUploadPhase('select')} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Terug</button>
                  <button onClick={handleBalansConfirm}
                    disabled={!uploadConfirm.entry_date || !uploadConfirm.amount}
                    className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50">
                    Opslaan als mutatie
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Mutatie toevoegen</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                <input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag (€, negatief = onttrekking)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="bijv. 5000 of -2500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
              <button onClick={() => addEntry.mutate(form)} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">Toevoegen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Bijdragen tab ---
function BijdragenTab({ vveId, isBeheerder }: { vveId: number; isBeheerder: boolean }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount_per_period: '', effective_from: '', notes: '' })

  const { data: plans = [] } = useQuery<ContributionPlan[]>({
    queryKey: ['contributions', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/contributions`).then((r) => r.data),
    enabled: !!vveId,
  })

  const addPlan = useMutation({
    mutationFn: (data: typeof form) => api.post(`/vves/${vveId}/financial/contributions`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contributions', vveId] }); qc.invalidateQueries({ queryKey: ['dashboard', vveId] }); setShowForm(false) },
  })

  return (
    <div className="space-y-6">
      {isBeheerder && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
            <Plus size={16} /> Nieuw bijdrageplan
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Bedrag per periode', 'Geldig vanaf', 'Geldig t/m', 'Notitie'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">Nog geen bijdrageplan ingesteld</td></tr>
            )}
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">{formatEur(p.amount_per_period)}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{format(new Date(p.effective_from), 'd MMM yyyy', { locale: nl })}</td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {p.effective_to ? format(new Date(p.effective_to), 'd MMM yyyy', { locale: nl }) : <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle size={14} /> Huidig</span>}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">{p.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Nieuw bijdrageplan</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag per periode (€) *</label>
                <input type="number" value={form.amount_per_period} onChange={(e) => setForm((f) => ({ ...f, amount_per_period: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geldig vanaf *</label>
                <input type="date" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notitie</label>
                <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
              <button onClick={() => addPlan.mutate(form)} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
