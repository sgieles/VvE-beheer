import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { Melding, MeldingStats } from '@/types'
import { AlertTriangle, Wrench, Plus, ChevronDown, Trash2, MessageSquare, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { toast } from '@/store/toastStore'

type StatusFilter = 'all' | 'nieuw' | 'in_behandeling' | 'opgelost' | 'afgesloten'

const URGENCY_CFG = {
  laag: { label: 'Laag', cls: 'bg-gray-100 text-gray-600' },
  normaal: { label: 'Normaal', cls: 'bg-blue-100 text-blue-700' },
  hoog: { label: 'Hoog', cls: 'bg-orange-100 text-orange-700' },
  spoed: { label: 'Spoed', cls: 'bg-red-100 text-red-700' },
}

const STATUS_CFG = {
  nieuw: { label: 'Nieuw', cls: 'bg-purple-100 text-purple-700' },
  in_behandeling: { label: 'In behandeling', cls: 'bg-blue-100 text-blue-700' },
  opgelost: { label: 'Opgelost', cls: 'bg-green-100 text-green-700' },
  afgesloten: { label: 'Afgesloten', cls: 'bg-gray-100 text-gray-500' },
}

const CATEGORIES = ['dak', 'kozijnen', 'gevel', 'installaties', 'gemeenschappelijk', 'overig']
const URGENCIES = ['laag', 'normaal', 'hoog', 'spoed']
const STATUS_FLOW: Record<string, string> = {
  nieuw: 'in_behandeling',
  in_behandeling: 'opgelost',
  opgelost: 'afgesloten',
}

export default function MeldingenPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'overig', urgency: 'normaal' })
  const [photo, setPhoto] = useState<File | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: meldingen = [], isLoading } = useQuery<Melding[]>({
    queryKey: ['meldingen', vveId, filter],
    queryFn: () => {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      return api.get(`/vves/${vveId}/meldingen${params}`).then((r) => r.data)
    },
    enabled: !!vveId,
  })

  const { data: stats } = useQuery<MeldingStats>({
    queryKey: ['meldingen-stats', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meldingen/stats`).then((r) => r.data),
    enabled: !!vveId,
  })

  const createMelding = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('title', form.title)
      if (form.description) fd.append('description', form.description)
      fd.append('category', form.category)
      fd.append('urgency', form.urgency)
      if (photo) fd.append('photo', photo)
      return api.post(`/vves/${vveId}/meldingen`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meldingen', vveId] })
      qc.invalidateQueries({ queryKey: ['meldingen-stats', vveId] })
      setForm({ title: '', description: '', category: 'overig', urgency: 'normaal' })
      setPhoto(null)
      setShowForm(false)
      toast('Melding ingediend')
    },
  })

  const updateMelding = useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: string; notes?: string; urgency?: string }) =>
      api.patch(`/vves/${vveId}/meldingen/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meldingen', vveId] })
      qc.invalidateQueries({ queryKey: ['meldingen-stats', vveId] })
    },
  })

  const deleteMelding = useMutation({
    mutationFn: (id: number) => api.delete(`/vves/${vveId}/meldingen/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meldingen', vveId] })
      qc.invalidateQueries({ queryKey: ['meldingen-stats', vveId] })
      toast('Melding verwijderd')
    },
  })

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Alle', count: (stats ? stats.nieuw + stats.in_behandeling + stats.opgelost + stats.afgesloten : 0) },
    { key: 'nieuw', label: 'Nieuw', count: stats?.nieuw ?? 0 },
    { key: 'in_behandeling', label: 'In behandeling', count: stats?.in_behandeling ?? 0 },
    { key: 'opgelost', label: 'Opgelost', count: stats?.opgelost ?? 0 },
    { key: 'afgesloten', label: 'Afgesloten', count: stats?.afgesloten ?? 0 },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meldingen</h1>
          <p className="text-gray-500 mt-1">Onderhoudsverzoeken en klachten</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Melding indienen
        </button>
      </div>

      {/* Spoed banner */}
      {stats && stats.spoed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-red-700">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="text-sm font-medium">
            {stats.spoed} spoedmelding{stats.spoed > 1 ? 'en' : ''} vereisen directe aandacht
          </span>
        </div>
      )}

      {/* Stat kaarten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Nieuw', value: stats?.nieuw ?? 0, cls: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'In behandeling', value: stats?.in_behandeling ?? 0, cls: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Opgelost', value: stats?.opgelost ?? 0, cls: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Afgesloten', value: stats?.afgesloten ?? 0, cls: 'text-gray-600', bg: 'bg-white border-gray-200' },
        ].map(({ label, value, cls, bg }) => (
          <div key={label} className={`border rounded-xl p-4 ${bg}`}>
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {filterTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              filter === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label} {count > 0 && <span className="text-xs opacity-70">({count})</span>}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-500 text-sm">Laden...</div>}

      {!isLoading && meldingen.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Wrench className="mx-auto text-gray-400 mb-3" size={32} />
          <p className="text-gray-500">Geen meldingen gevonden.</p>
        </div>
      )}

      <div className="space-y-3">
        {meldingen.map((m) => {
          const urgCfg = URGENCY_CFG[m.urgency as keyof typeof URGENCY_CFG]
          const stCfg = STATUS_CFG[m.status as keyof typeof STATUS_CFG]
          const isExpanded = expandedId === m.id
          const nextStatus = STATUS_FLOW[m.status]

          return (
            <div key={m.id} className={`bg-white border rounded-xl overflow-hidden ${
              m.urgency === 'spoed' && m.status === 'nieuw' ? 'border-red-300' : 'border-gray-200'
            }`}>
              {/* Card header */}
              <div
                className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5">
                    <Wrench size={16} className="text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgCfg?.cls}`}>
                        {urgCfg?.label}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stCfg?.cls}`}>
                        {stCfg?.label}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{m.category}</span>
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(m.reported_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                      {m.resolved_at && ` · Opgelost: ${format(new Date(m.resolved_at), 'd MMM yyyy', { locale: nl })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {isBeheerder && nextStatus && (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateMelding.mutate({ id: m.id, status: nextStatus }) }}
                      className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      → {STATUS_CFG[nextStatus as keyof typeof STATUS_CFG]?.label}
                    </button>
                  )}
                  {isBeheerder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm('Melding verwijderen?')) deleteMelding.mutate(m.id)
                      }}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  {m.description && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Omschrijving</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.description}</p>
                    </div>
                  )}

                  {m.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <MessageSquare size={11} /> Notitie beheerder
                      </p>
                      <p className="text-sm text-amber-800 whitespace-pre-wrap">{m.notes}</p>
                    </div>
                  )}

                  {isBeheerder && (
                    <BeheerderActies
                      melding={m}
                      onUpdate={(data) => updateMelding.mutate({ id: m.id, ...data })}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal: nieuwe melding */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Melding indienen</h2>
            <p className="text-sm text-gray-500 mb-4">Beschrijf het probleem zo duidelijk mogelijk.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="bijv. Lekkage dak portiek 59"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Toelichting</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Beschrijf het probleem in detail..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgentie</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    {URGENCIES.map((u) => (
                      <option key={u} value={u}>{URGENCY_CFG[u as keyof typeof URGENCY_CFG].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto (optioneel)</label>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 text-gray-600"
                >
                  <Paperclip size={14} />
                  {photo ? photo.name : 'Foto kiezen'}
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => form.title && createMelding.mutate()}
                  disabled={!form.title || createMelding.isPending}
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50"
                >
                  Indienen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BeheerderActies({
  melding,
  onUpdate,
}: {
  melding: Melding
  onUpdate: (data: { status?: string; notes?: string; urgency?: string }) => void
}) {
  const [notes, setNotes] = useState(melding.notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)

  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Beheerder acties</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={melding.status}
            onChange={(e) => onUpdate({ status: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            {Object.entries(STATUS_CFG).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Urgentie</label>
          <select
            value={melding.urgency}
            onChange={(e) => onUpdate({ urgency: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>{URGENCY_CFG[u as keyof typeof URGENCY_CFG].label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Interne notitie</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true) }}
          placeholder="Voeg een interne notitie toe..."
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
        />
      </div>
      {notesDirty && (
        <button
          onClick={() => { onUpdate({ notes }); setNotesDirty(false) }}
          className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 font-medium"
        >
          Notitie opslaan
        </button>
      )}
    </div>
  )
}
