import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { MJOPItem, Quote, ContributionPlan, ReserveFondsCombinedEntry } from '@/types'
import { Tooltip, PieChart, Pie, Cell } from 'recharts'
import { Upload, Plus, Pencil, X, RotateCcw, ChevronDown, ChevronRight, Download, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import ConfirmDialog from '@/components/ConfirmDialog'

function formatEur(v: number | string) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v))
}

function Skel({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-gray-200 rounded animate-pulse`} />
}


function MJOPSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <Skel w="w-40" h="h-4" />
        <div className="flex gap-6">
          <Skel w="w-40" h="h-40" />
          <div className="flex-1 space-y-2 pt-2">
            {[0, 1, 2, 3].map((i) => <Skel key={i} h="h-3" />)}
          </div>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-3"><Skel w="w-16" h="h-4" /></div>
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((j) => <Skel key={j} h="h-3" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  dak: '#4f46e5',
  gevel: '#7c3aed',
  kozijnen: '#0891b2',
  schilderwerk: '#059669',
  installaties: '#d97706',
  lift: '#dc2626',
  overig: '#6b7280',
}

const CATEGORIES = ['dak', 'gevel', 'kozijnen', 'schilderwerk', 'installaties', 'lift', 'overig']

const STATUS_NL: Record<string, string> = {
  planned: 'Gepland',
  quoted: 'Offerte',
  approved: 'Goedgekeurd',
  completed: 'Afgerond',
  cancelled: 'Geannuleerd',
}

const TABS = ['MJOP', 'Reservefonds', 'Bijdragen'] as const
type Tab = typeof TABS[number]

export default function FinancialPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const [tab, setTab] = useState<Tab>('MJOP')

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

      {tab === 'MJOP' && <MJOPTab vveId={vveId!} isBeheerder={isBeheerder} />}
      {tab === 'Reservefonds' && <ReserveFondsTab vveId={vveId!} isBeheerder={isBeheerder} />}
      {tab === 'Bijdragen' && <BijdragenTab vveId={vveId!} isBeheerder={isBeheerder} />}
    </div>
  )
}

// --- MJOP tab ---
function MJOPTab({ vveId, isBeheerder }: { vveId: number; isBeheerder: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editItem, setEditItem] = useState<MJOPItem | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: items = [], isLoading } = useQuery<MJOPItem[]>({
    queryKey: ['mjop-items', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/mjop/items`).then((r) => r.data),
    enabled: !!vveId,
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/vves/${vveId}/financial/mjop/upload`, form)
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setUploadError(detail ?? 'Upload mislukt. Controleer het bestand en probeer opnieuw.')
    } finally {
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

  const [showAddForm, setShowAddForm] = useState(false)

  const addItem = useMutation({
    mutationFn: (data: { description: string; category?: string; planned_year: number; planned_quarter?: number; planned_amount: string }) =>
      api.post(`/vves/${vveId}/financial/mjop/items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setShowAddForm(false)
    },
  })

  const handleExport = async () => {
    const resp = await api.get(`/vves/${vveId}/financial/mjop/export`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([resp.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'MJOP_export.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkMode, setBulkMode] = useState<'jaar' | 'kwartaal'>('jaar')
  const [bulkOffset, setBulkOffset] = useState(1)
  const [bulkStatus, setBulkStatus] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [reviveItem, setReviveItem] = useState<MJOPItem | null>(null)
  const [assigningQ1, setAssigningQ1] = useState(false)
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set())
  const [inlineEdit, setInlineEdit] = useState<{
    itemId: number; field: 'planned_quarter' | 'planned_amount' | 'status'; value: string
  } | null>(null)
  const [quoteItemId, setQuoteItemId] = useState<number | null>(null)
  const quoteItem = quoteItemId ? items.find((i) => i.id === quoteItemId) ?? null : null

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const selectAll = (ids: number[]) =>
    setSelectedIds((prev) => ids.every((id) => prev.has(id)) ? new Set() : new Set(ids))

  const toggleYear = (year: number) =>
    setCollapsedYears((prev) => { const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n })

  const saveInline = (itemId: number, field: 'planned_quarter' | 'planned_amount' | 'status', value: string) => {
    let data: Partial<MJOPItem> = {}
    if (field === 'planned_quarter') data = { planned_quarter: value ? parseInt(value) : undefined }
    else if (field === 'planned_amount') { if (!value) return; data = { planned_amount: value as unknown as string } }
    else if (field === 'status') data = { status: value as MJOPItem['status'] }
    updateItem.mutate({ id: itemId, data })
    setInlineEdit(null)
  }

  function addQuarters(year: number, quarter: number, steps: number): [number, number] {
    const total = year * 4 + (quarter - 1) + steps
    return [Math.floor(total / 4), total % 4 + 1]
  }

  const bulkShift = useMutation({
    mutationFn: async (offset: number) => {
      const toShift = items.filter((i) => selectedIds.has(i.id))
      await Promise.all(
        toShift.map((i) => {
          if (bulkMode === 'kwartaal') {
            const q = i.planned_quarter ?? 1
            const [newYear, newQ] = addQuarters(i.planned_year, q, offset)
            return api.patch(`/vves/${vveId}/financial/mjop/items/${i.id}`, {
              planned_year: newYear, planned_quarter: newQ,
            })
          }
          return api.patch(`/vves/${vveId}/financial/mjop/items/${i.id}`, {
            planned_year: i.planned_year + offset,
          })
        })
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setSelectedIds(new Set())
    },
  })

  const cancelItem = useMutation({
    mutationFn: (id: number) => api.patch(`/vves/${vveId}/financial/mjop/items/${id}`, { status: 'cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
    },
  })

  const bulkStatusChange = useMutation({
    mutationFn: async (status: string) => {
      await Promise.all([...selectedIds].map((id) =>
        api.patch(`/vves/${vveId}/financial/mjop/items/${id}`, { status })
      ))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setSelectedIds(new Set())
      setBulkStatus('')
    },
  })

  const assignQ1 = async () => {
    setAssigningQ1(true)
    try {
      await api.post(`/vves/${vveId}/financial/mjop/assign-quarters?quarter=1`)
      qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
    } finally {
      setAssigningQ1(false)
    }
  }

  const activeItems = items.filter((i) => i.status !== 'cancelled')
  const cancelledItems = items.filter((i) => i.status === 'cancelled')
  const noQuarterCount = activeItems.filter((i) => i.planned_quarter == null).length

  const groupedByYear = activeItems.reduce<Record<number, MJOPItem[]>>((acc, item) => {
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
    cancelled: 'bg-red-100 text-red-500',
  }

  // Kosten per categorie (actieve items)
  const costsByCategory = activeItems.reduce<Record<string, number>>((acc, item) => {
    const cat = item.category ?? 'overig'
    acc[cat] = (acc[cat] ?? 0) + parseFloat(item.planned_amount)
    return acc
  }, {})
  const pieData = Object.entries(costsByCategory)
    .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? '#6b7280' }))
    .sort((a, b) => b.value - a.value)
  const totalPie = pieData.reduce((s, d) => s + d.value, 0)

  // Actueel vs. begroot: afgeronde posten met werkelijk bedrag
  const completedWithActual = activeItems.filter((i) => i.status === 'completed' && i.actual_amount)
  const totalPlannedCompleted = completedWithActual.reduce((s, i) => s + parseFloat(i.planned_amount), 0)
  const totalActualCompleted = completedWithActual.reduce((s, i) => s + parseFloat(i.actual_amount!), 0)
  const deviation = totalActualCompleted - totalPlannedCompleted
  const deviationPct = totalPlannedCompleted > 0 ? (deviation / totalPlannedCompleted) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Donut chart kosten per categorie */}
      {items.length > 0 && pieData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Kosten per categorie (totaal gepland)</h3>
          <div className="flex items-center gap-8">
            <div className="shrink-0">
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx={75} cy={75} innerRadius={42} outerRadius={72} dataKey="value" startAngle={90} endAngle={-270}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [formatEur(v), '']} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </div>
            <div className="flex-1 space-y-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs capitalize text-gray-700 w-24">{d.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${(d.value / totalPie) * 100}%`, backgroundColor: d.color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-900 w-20 text-right">{formatEur(d.value)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{((d.value / totalPie) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actueel vs. begroot samenvatting */}
      {completedWithActual.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Actueel vs. begroot — afgeronde posten</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Afgerond</p>
              <p className="text-xl font-bold text-gray-900">{completedWithActual.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Totaal begroot</p>
              <p className="text-xl font-bold text-gray-900">{formatEur(totalPlannedCompleted)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Totaal werkelijk</p>
              <p className="text-xl font-bold text-gray-900">{formatEur(totalActualCompleted)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Afwijking</p>
              <p className={`text-xl font-bold ${deviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {deviation > 0 ? '+' : ''}{formatEur(deviation)}
                <span className="text-sm font-normal ml-1">({deviation > 0 ? '+' : ''}{deviationPct.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk-bewerking balk */}
      {isBeheerder && selectedIds.size > 0 && (
        <div className="bg-indigo-600 text-white rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium">{selectedIds.size} post{selectedIds.size !== 1 ? 'en' : ''} geselecteerd</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-indigo-400 text-xs font-medium">
              {(['jaar', 'kwartaal'] as const).map((m) => (
                <button key={m} onClick={() => { setBulkMode(m); setBulkOffset(1) }}
                  className={`px-3 py-1.5 transition-colors capitalize ${bulkMode === m ? 'bg-white text-indigo-700' : 'text-indigo-200 hover:text-white'}`}>
                  {m}
                </button>
              ))}
            </div>
            <span className="text-sm text-indigo-200">Verschuif</span>
            <select
              value={bulkOffset}
              onChange={(e) => setBulkOffset(parseInt(e.target.value))}
              className="bg-indigo-700 text-white text-sm rounded-lg px-2 py-1 border border-indigo-400 focus:outline-none"
            >
              {(bulkMode === 'jaar' ? [-3, -2, -1, 1, 2, 3] : [-4, -3, -2, -1, 1, 2, 3, 4]).map((n) => (
                <option key={n} value={n}>{n > 0 ? `+${n}` : n} {bulkMode === 'jaar' ? 'j' : 'kw'}</option>
              ))}
            </select>
            <button
              onClick={() => bulkShift.mutate(bulkOffset)}
              disabled={bulkShift.isPending}
              className="bg-white text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition-colors"
            >
              {bulkShift.isPending ? 'Verschuiven...' : 'Uitvoeren'}
            </button>
            <div className="w-px h-5 bg-indigo-400 mx-1 hidden sm:block" />
            <span className="text-sm text-indigo-200">Status</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="bg-indigo-700 text-white text-sm rounded-lg px-2 py-1 border border-indigo-400 focus:outline-none"
            >
              <option value="">— kies —</option>
              {Object.entries(STATUS_NL).filter(([v]) => v !== 'cancelled').map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => bulkStatus && bulkStatusChange.mutate(bulkStatus)}
              disabled={!bulkStatus || bulkStatusChange.isPending}
              className="bg-white text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition-colors"
            >
              {bulkStatusChange.isPending ? 'Bezig...' : 'Toepassen'}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-indigo-200 hover:text-white text-sm transition-colors">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>{uploadError}</span>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {isBeheerder && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.pdf" onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <Upload size={16} />
              {uploading ? 'Verwerken...' : 'MJOP uploaden (Excel/PDF)'}
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Post toevoegen
            </button>
          </>
        )}
        {items.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ml-auto"
          >
            <Download size={16} />
            Exporteren
          </button>
        )}
        {isBeheerder && noQuarterCount > 0 && (
          <button
            onClick={assignQ1}
            disabled={assigningQ1}
            className="flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {assigningQ1 ? 'Bezig...' : `Wijs Q1 toe aan ${noQuarterCount} post${noQuarterCount !== 1 ? 'en' : ''} zonder kwartaal`}
          </button>
        )}
      </div>

      {isLoading && <MJOPSkeleton />}

      {!isLoading && items.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Upload className="mx-auto text-gray-400 mb-3" size={32} />
          <p className="text-gray-500">Nog geen MJOP geladen. Upload een Excel- of PDF-bestand.</p>
        </div>
      )}

      {Object.entries(groupedByYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, yearItems]) => (
        <div key={year} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleYear(Number(year))}
            className="w-full bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              {collapsedYears.has(Number(year))
                ? <ChevronRight size={15} className="text-gray-400" />
                : <ChevronDown size={15} className="text-gray-400" />}
              <h3 className="font-semibold text-gray-900">{year}</h3>
              <span className="text-xs text-gray-400">{yearItems.length} post{yearItems.length !== 1 ? 'en' : ''}</span>
            </div>
            <span className="text-sm text-gray-500">
              {formatEur(yearItems.reduce((s, i) => s + parseFloat(i.planned_amount), 0))} begroot
            </span>
          </button>
          {!collapsedYears.has(Number(year)) && <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                {isBeheerder && (
                  <th className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={yearItems.length > 0 && yearItems.every((i) => selectedIds.has(i.id))}
                      onChange={() => selectAll(yearItems.map((i) => i.id))}
                      className="rounded text-indigo-600"
                    />
                  </th>
                )}
                {['Omschrijving', 'Categorie', 'Kwartaal', 'Begroot', 'Werkelijk', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-xs text-gray-500 px-6 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {yearItems.map((item) => {
                const isSelected = selectedIds.has(item.id)
                const hasDeviation = item.status === 'completed' && item.actual_amount
                const actualOver = hasDeviation && parseFloat(item.actual_amount!) > parseFloat(item.planned_amount)
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50/60' : item.manually_adjusted ? 'bg-blue-50/30' : ''}`}>
                    {isBeheerder && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded text-indigo-600"
                        />
                      </td>
                    )}
                    <td className="px-6 py-3 text-sm text-gray-900">{item.description}</td>
                    <td className="px-6 py-3">
                      {item.category ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${CATEGORY_COLORS[item.category] ?? '#6b7280'}18`, color: CATEGORY_COLORS[item.category] ?? '#6b7280' }}>
                          {item.category}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {isBeheerder && inlineEdit?.itemId === item.id && inlineEdit.field === 'planned_quarter' ? (
                        <select
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) => saveInline(item.id, 'planned_quarter', e.target.value)}
                          onBlur={() => setInlineEdit(null)}
                          className="text-xs border border-primary-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                          <option value="">Heel jaar</option>
                          {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                        </select>
                      ) : (
                        <span
                          onClick={() => isBeheerder && setInlineEdit({ itemId: item.id, field: 'planned_quarter', value: item.planned_quarter?.toString() ?? '' })}
                          className={isBeheerder ? 'cursor-pointer hover:text-primary-600 hover:underline decoration-dotted underline-offset-2' : ''}
                        >
                          {item.planned_quarter ? `Q${item.planned_quarter}` : 'Heel jaar'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {isBeheerder && inlineEdit?.itemId === item.id && inlineEdit.field === 'planned_amount' ? (
                        <input
                          autoFocus
                          type="number"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                          onBlur={() => saveInline(item.id, 'planned_amount', inlineEdit.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInline(item.id, 'planned_amount', inlineEdit.value)
                            if (e.key === 'Escape') setInlineEdit(null)
                          }}
                          className="w-24 text-sm border border-primary-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      ) : (
                        <span
                          onClick={() => isBeheerder && setInlineEdit({ itemId: item.id, field: 'planned_amount', value: item.planned_amount })}
                          className={isBeheerder ? 'cursor-pointer hover:text-primary-600 hover:underline decoration-dotted underline-offset-2' : ''}
                        >
                          {formatEur(item.planned_amount)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {item.actual_amount ? (
                        <div>
                          <span className={actualOver ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {formatEur(item.actual_amount)}
                          </span>
                          {hasDeviation && (
                            <span className={`block text-xs ${actualOver ? 'text-red-400' : 'text-green-500'}`}>
                              {actualOver ? '+' : ''}{formatEur(parseFloat(item.actual_amount!) - parseFloat(item.planned_amount))}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      {isBeheerder && inlineEdit?.itemId === item.id && inlineEdit.field === 'status' ? (
                        <select
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) => saveInline(item.id, 'status', e.target.value)}
                          onBlur={() => setInlineEdit(null)}
                          className="text-xs border border-primary-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                          {Object.entries(STATUS_NL).filter(([v]) => v !== 'cancelled').map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => isBeheerder && setInlineEdit({ itemId: item.id, field: 'status', value: item.status })}
                          className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[item.status]} ${isBeheerder ? 'cursor-pointer hover:opacity-75' : ''}`}
                        >
                          {STATUS_NL[item.status] ?? item.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {(isBeheerder || item.quotes.length > 0) && (
                          <button
                            onClick={() => setQuoteItemId(item.id)}
                            title={`${item.quotes.length} offerte${item.quotes.length !== 1 ? 's' : ''}`}
                            className={`flex items-center gap-1 transition-colors ${
                              item.quotes.length > 0
                                ? item.quotes.some((q) => q.is_approved)
                                  ? 'text-green-500 hover:text-green-700'
                                  : 'text-blue-500 hover:text-blue-700'
                                : 'text-gray-300 hover:text-gray-400'
                            }`}
                          >
                            <FileText size={14} />
                            {item.quotes.length > 0 && (
                              <span className="text-xs font-medium tabular-nums">{item.quotes.length}</span>
                            )}
                          </button>
                        )}
                        {isBeheerder && (
                          <>
                            <button onClick={() => setEditItem(item)} className="text-gray-400 hover:text-primary-600">
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => cancelItem.mutate(item.id)}
                              title="Annuleer post"
                              className="text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>}
        </div>
      ))}

      {/* Geannuleerde posten */}
      {cancelledItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {showCancelled ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              <span className="text-sm font-semibold text-gray-700">Geannuleerde posten</span>
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{cancelledItems.length}</span>
            </div>
            <span className="text-xs text-gray-400">Totaal begroot: {formatEur(cancelledItems.reduce((s, i) => s + parseFloat(i.planned_amount), 0))}</span>
          </button>

          {showCancelled && (
            <table className="w-full border-t border-gray-100">
              <thead>
                <tr className="border-b border-gray-100 bg-red-50/40">
                  {['Omschrijving', 'Categorie', 'Jaar', 'Bedrag', ''].map((h) => (
                    <th key={h} className="text-left text-xs text-gray-500 px-6 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cancelledItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 opacity-70">
                    <td className="px-6 py-3 text-sm text-gray-500 line-through">{item.description}</td>
                    <td className="px-6 py-3">
                      {item.category ? (
                        <span className="text-xs text-gray-400 capitalize">{item.category}</span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">
                      {item.planned_year}{item.planned_quarter ? ` Q${item.planned_quarter}` : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">{formatEur(item.planned_amount)}</td>
                    <td className="px-6 py-3">
                      {isBeheerder && (
                        <button
                          onClick={() => setReviveItem(item)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                        >
                          <RotateCcw size={12} /> Heractiveer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAddForm && (
        <MJOPItemAddModal
          onClose={() => setShowAddForm(false)}
          onSave={(data) => addItem.mutate(data)}
          isSaving={addItem.isPending}
        />
      )}

      {editItem && (
        <MJOPItemEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => updateItem.mutate({ id: editItem.id, data })}
        />
      )}

      {reviveItem && (
        <ReviveModal
          item={reviveItem}
          onClose={() => setReviveItem(null)}
          onSave={(data) => {
            updateItem.mutate({ id: reviveItem.id, data })
            setReviveItem(null)
          }}
        />
      )}

      {quoteItem && (
        <OfferteModal
          item={quoteItem}
          vveId={vveId}
          isBeheerder={isBeheerder}
          onClose={() => setQuoteItemId(null)}
        />
      )}
    </div>
  )
}

function OfferteModal({
  item, vveId, isBeheerder, onClose,
}: {
  item: MJOPItem
  vveId: number
  isBeheerder: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(item.quotes.length === 0 && isBeheerder)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [form, setForm] = useState({
    supplier_name: '',
    quoted_amount: '',
    contact_person: '',
    contact_email: '',
    date_received: '',
    valid_until: '',
    work_description: '',
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['mjop-items', vveId] })

  const addQuote = useMutation({
    mutationFn: (fd: FormData) =>
      api.post(`/vves/${vveId}/financial/quotes`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data as Quote),
    onSuccess: () => {
      invalidate()
      setForm({ supplier_name: '', quoted_amount: '', contact_person: '', contact_email: '', date_received: '', valid_until: '', work_description: '', notes: '' })
      setFile(null)
      setShowForm(false)
    },
  })

  const awardQuote = useMutation({
    mutationFn: (quoteId: number) =>
      api.post(`/vves/${vveId}/financial/quotes/${quoteId}/approve`, {}),
    onSuccess: invalidate,
  })

  const deleteQuote = useMutation({
    mutationFn: (quoteId: number) =>
      api.delete(`/vves/${vveId}/financial/quotes/${quoteId}`),
    onSuccess: invalidate,
  })

  const downloadQuote = async (q: Quote) => {
    const resp = await api.get(`/vves/${vveId}/financial/quotes/${q.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([resp.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `offerte_${q.supplier_name.replace(/\s+/g, '_')}_${q.id}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSubmit = () => {
    if (!form.supplier_name || !form.quoted_amount) return
    const fd = new FormData()
    fd.append('mjop_item_id', String(item.id))
    fd.append('supplier_name', form.supplier_name)
    fd.append('quoted_amount', form.quoted_amount)
    if (form.notes) fd.append('notes', form.notes)
    if (form.date_received) fd.append('date_received', form.date_received)
    if (form.valid_until) fd.append('valid_until', form.valid_until)
    if (form.contact_person) fd.append('contact_person', form.contact_person)
    if (form.contact_email) fd.append('contact_email', form.contact_email)
    if (form.work_description) fd.append('work_description', form.work_description)
    if (file) fd.append('file', file)
    addQuote.mutate(fd)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Offertes</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">
              {item.description} · {item.planned_year}{item.planned_quarter ? ` Q${item.planned_quarter}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mt-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {item.quotes.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">Nog geen offertes toegevoegd</p>
          )}

          {item.quotes.map((q) => (
            <div
              key={q.id}
              className={`border rounded-lg p-4 ${q.is_approved ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{q.supplier_name}</span>
                    {q.is_approved && (
                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                        Gegund
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 flex-wrap text-sm">
                    <span className="font-semibold text-gray-800">{formatEur(q.quoted_amount)}</span>
                    {q.final_amount && q.final_amount !== q.quoted_amount && (
                      <span className="text-gray-500 text-xs">Definitief: {formatEur(q.final_amount)}</span>
                    )}
                    {q.date_received && (
                      <span className="text-gray-400 text-xs">Ontvangen: {q.date_received}</span>
                    )}
                    {q.valid_until && (
                      <span className="text-gray-400 text-xs">Geldig t/m: {q.valid_until}</span>
                    )}
                  </div>
                  {q.contact_person && (
                    <p className="text-xs text-gray-500 mt-1">
                      {q.contact_person}{q.contact_email ? ` · ${q.contact_email}` : ''}
                    </p>
                  )}
                  {q.work_description && (
                    <p className="text-xs text-gray-600 mt-1.5 italic">{q.work_description}</p>
                  )}
                  {q.notes && <p className="text-xs text-gray-400 mt-1">{q.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {q.document_path && (
                    <button
                      onClick={() => downloadQuote(q)}
                      title="Download offerte"
                      className="text-blue-400 hover:text-blue-600 p-1 transition-colors"
                    >
                      <Download size={14} />
                    </button>
                  )}
                  {isBeheerder && !q.is_approved && (
                    <button
                      onClick={() => awardQuote.mutate(q.id)}
                      disabled={awardQuote.isPending}
                      className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-200 hover:border-green-400 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      Gunnen
                    </button>
                  )}
                  {isBeheerder && (
                    <button
                      onClick={() => setConfirmDel(q.id)}
                      disabled={deleteQuote.isPending}
                      className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isBeheerder && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-lg py-3 text-sm text-gray-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Offerte toevoegen
            </button>
          )}

          {isBeheerder && showForm && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Nieuwe offerte</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Aannemer / leverancier *</label>
                  <input
                    type="text"
                    autoFocus
                    value={form.supplier_name}
                    onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                    placeholder="Naam bedrijf"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Offertebedrag (€) *</label>
                  <input
                    type="number"
                    value={form.quoted_amount}
                    onChange={(e) => setForm((f) => ({ ...f, quoted_amount: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ontvangen op</label>
                  <input
                    type="date"
                    value={form.date_received}
                    onChange={(e) => setForm((f) => ({ ...f, date_received: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contactpersoon</label>
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                    placeholder="Naam"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-mailadres</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                    placeholder="contact@bedrijf.nl"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Geldig tot</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Omschrijving werkzaamheden</label>
                  <textarea
                    value={form.work_description}
                    onChange={(e) => setForm((f) => ({ ...f, work_description: e.target.value }))}
                    rows={2}
                    placeholder="Wat omvat de offerte precies?"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white resize-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Interne notitie</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optionele aantekening"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">PDF-offerte (optioneel)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm border border-gray-300 hover:border-primary-400 text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Upload size={14} />
                    {file ? file.name : 'Bestand kiezen'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowForm(false); setFile(null) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.supplier_name || !form.quoted_amount || addQuote.isPending}
                  className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {addQuote.isPending ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
              {addQuote.isError && (
                <p className="text-xs text-red-600 mt-2">Opslaan mislukt. Controleer de invoer.</p>
              )}
            </div>
          )}
        </div>
      </div>
      {confirmDel !== null && (
        <ConfirmDialog
          message="Offerte verwijderen? Dit kan niet ongedaan worden gemaakt."
          onConfirm={() => { deleteQuote.mutate(confirmDel); setConfirmDel(null) }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

function MJOPItemAddModal({ onClose, onSave, isSaving }: {
  onClose: () => void
  onSave: (data: { description: string; category?: string; planned_year: number; planned_quarter?: number; planned_amount: string }) => void
  isSaving: boolean
}) {
  const thisYear = new Date().getFullYear()
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [year, setYear] = useState(thisYear.toString())
  const [quarter, setQuarter] = useState('')
  const [amount, setAmount] = useState('')

  const canSave = description.trim().length > 0 && year && parseFloat(amount) > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Post toevoegen</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving *</label>
            <input
              autoFocus
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="bijv. Dakbedekking vervangen"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jaar *</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kwartaal</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">Heel jaar</option>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Begroot bedrag (€) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">— onbekend —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            Annuleren
          </button>
          <button
            disabled={!canSave || isSaving}
            onClick={() => onSave({
              description: description.trim(),
              category: category || undefined,
              planned_year: parseInt(year),
              planned_quarter: quarter ? parseInt(quarter) : undefined,
              planned_amount: amount,
            })}
            className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50"
          >
            {isSaving ? 'Opslaan...' : 'Toevoegen'}
          </button>
        </div>
      </div>
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
  const [category, setCategory] = useState(item.category ?? '')
  const [status, setStatus] = useState(item.status)

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">— onbekend —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as MJOPItem['status'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                {Object.entries(STATUS_NL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
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
              category: category || undefined,
              status,
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

function ReviveModal({ item, onClose, onSave }: {
  item: MJOPItem; onClose: () => void; onSave: (data: Partial<MJOPItem>) => void
}) {
  const [year, setYear] = useState(item.planned_year.toString())
  const [quarter, setQuarter] = useState(item.planned_quarter?.toString() ?? '')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw size={18} className="text-indigo-600" />
          <h2 className="text-lg font-semibold">Post heractiveren</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">{item.description}</p>
        <div className="grid grid-cols-2 gap-4 mb-5">
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
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            Annuleren
          </button>
          <button
            onClick={() => onSave({
              status: 'planned',
              planned_year: parseInt(year),
              planned_quarter: quarter ? parseInt(quarter) : undefined,
            })}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700 font-medium"
          >
            Heractiveer
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

  const { data: entries = [] } = useQuery<ReserveFondsCombinedEntry[]>({
    queryKey: ['reservefonds', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/reservefonds/combined`).then((r) => r.data),
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

  const balance = entries.length > 0 ? entries[entries.length - 1].running_balance : 0

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Huidig saldo reservefonds</p>
          <p className={`text-3xl font-bold mt-1 ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatEur(balance)}</p>
          {entries.filter(e => e.entry_type === 'contribution').length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              incl. {entries.filter(e => e.entry_type === 'contribution').length} bijdrage-betalingen
            </p>
          )}
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
              {['Datum', 'Omschrijving', 'Bedrag', 'Saldo'].map((h) => (
                <th key={h} className={`text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 ${h === 'Bedrag' || h === 'Saldo' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">Nog geen mutaties ingevoerd</td></tr>
            )}
            {entries.map((e, i) => {
              const isContrib = e.entry_type === 'contribution'
              return (
                <tr key={`${e.entry_type}-${e.id ?? i}`} className={isContrib ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                    {format(new Date(e.entry_date), 'd MMM yyyy', { locale: nl })}
                  </td>
                  <td className="px-6 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      {isContrib && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Bijdrage</span>
                      )}
                      <span className={isContrib ? 'text-gray-500' : 'text-gray-900'}>{e.description || '—'}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-2.5 text-sm font-medium text-right ${e.amount >= 0 ? (isContrib ? 'text-emerald-600' : 'text-green-600') : 'text-red-600'}`}>
                    {e.amount >= 0 ? '+' : ''}{formatEur(e.amount)}
                  </td>
                  <td className={`px-6 py-2.5 text-sm text-right font-medium ${e.running_balance < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {formatEur(e.running_balance)}
                  </td>
                </tr>
              )
            })}
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
  const [editPlan, setEditPlan] = useState<ContributionPlan | null>(null)
  const [editForm, setEditForm] = useState({ effective_to: '', notes: '' })

  const { data: plans = [] } = useQuery<ContributionPlan[]>({
    queryKey: ['contributions', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/contributions`).then((r) => r.data),
    enabled: !!vveId,
  })

  const updatePlan = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { effective_to: string | null; notes: string | null } }) =>
      api.patch(`/vves/${vveId}/financial/contributions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contributions', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      qc.invalidateQueries({ queryKey: ['reservefonds', vveId] })
      setEditPlan(null)
    },
  })

  function openEdit(p: ContributionPlan) {
    setEditPlan(p)
    setEditForm({
      effective_to: p.effective_to ?? '',
      notes: p.notes ?? '',
    })
  }

  function handleUpdatePlan() {
    if (!editPlan) return
    updatePlan.mutate({
      id: editPlan.id,
      data: {
        effective_to: editForm.effective_to || null,
        notes: editForm.notes || null,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Bedrag per periode', 'Geldig vanaf', 'Geldig t/m', 'Notitie', ...(isBeheerder ? [''] : [])].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.length === 0 && (
              <tr>
                <td colSpan={isBeheerder ? 5 : 4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-1">
                      <Plus size={18} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Nog geen bijdrageplan</p>
                    <p className="text-xs text-gray-400 max-w-xs">
                      Voeg een bijdrageplan toe via het tabblad Appartementen → Bijdragen per eenheid.
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {plans.map((p) => {
              const isHuidig = !p.effective_to
              return (
                <tr key={p.id} className={isHuidig ? 'bg-green-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {formatEur(p.amount_per_period)}
                    {isHuidig && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">actief</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{format(new Date(p.effective_from), 'd MMM yyyy', { locale: nl })}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {p.effective_to
                      ? format(new Date(p.effective_to), 'd MMM yyyy', { locale: nl })
                      : <span className="text-green-600 font-medium">—</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{p.notes ?? '—'}</td>
                  {isBeheerder && (
                    <td className="px-6 py-3">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-gray-400 hover:text-primary-600 transition-colors"
                        title="Bewerken"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Bijdrageplan bewerken</h2>
            <p className="text-sm text-gray-500 mb-4">
              {formatEur(editPlan.amount_per_period)} — geldig vanaf {format(new Date(editPlan.effective_from), 'd MMM yyyy', { locale: nl })}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geldig t/m</label>
                <input
                  type="date"
                  value={editForm.effective_to}
                  onChange={(e) => setEditForm((f) => ({ ...f, effective_to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Leeg laten = plan heeft geen einddatum (actief)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notitie</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditPlan(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                Annuleren
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={updatePlan.isPending}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50"
              >
                {updatePlan.isPending ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
