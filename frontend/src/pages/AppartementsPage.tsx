import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Appartement, VvE } from '@/types'
import { Plus, Pencil, Trash2, X, Home } from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value)
}

interface AppartementForm {
  naam: string
  nummer: string
  eigenaar_naam: string
  aandeel: string
}

const emptyForm: AppartementForm = { naam: '', nummer: '', eigenaar_naam: '', aandeel: '1' }

export default function AppartementsPage() {
  const { activeVveId, activeVve } = useAuthStore()
  const vveId = activeVveId
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Appartement | null>(null)
  const [form, setForm] = useState<AppartementForm>(emptyForm)
  const [showDenominatorEdit, setShowDenominatorEdit] = useState(false)
  const [denominatorInput, setDenominatorInput] = useState('')
  const [error, setError] = useState('')

  const { data: appartementen = [], isLoading } = useQuery<Appartement[]>({
    queryKey: ['appartementen', vveId],
    queryFn: () => api.get(`/vves/${vveId}/appartementen`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/dashboard`).then((r) => r.data),
    enabled: !!vveId,
  })

  const createMut = useMutation({
    mutationFn: (data: AppartementForm) =>
      api.post(`/vves/${vveId}/appartementen`, {
        naam: data.naam,
        nummer: data.nummer || null,
        eigenaar_naam: data.eigenaar_naam || null,
        aandeel: parseFloat(data.aandeel),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appartementen', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      closeModal()
    },
    onError: () => setError('Opslaan mislukt'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AppartementForm }) =>
      api.patch(`/vves/${vveId}/appartementen/${id}`, {
        naam: data.naam,
        nummer: data.nummer || null,
        eigenaar_naam: data.eigenaar_naam || null,
        aandeel: parseFloat(data.aandeel),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appartementen', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      closeModal()
    },
    onError: () => setError('Opslaan mislukt'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/vves/${vveId}/appartementen/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appartementen', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
    },
  })

  const updateVveMut = useMutation({
    mutationFn: (share_denominator: number) =>
      api.patch(`/vves/${vveId}`, {
        name: activeVve?.name ?? 'Mijn VvE',
        contribution_frequency: activeVve?.contribution_frequency ?? 'monthly',
        share_denominator,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vves'] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setShowDenominatorEdit(false)
    },
  })

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(a: Appartement) {
    setEditing(a)
    setForm({
      naam: a.naam,
      nummer: a.nummer ?? '',
      eigenaar_naam: a.eigenaar_naam ?? '',
      aandeel: a.aandeel,
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(emptyForm)
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
    } else {
      createMut.mutate(form)
    }
  }

  const shareDenominator: number = (activeVve as VvE | undefined)?.share_denominator ?? 1

  const totalAandeel = appartementen.reduce((s, a) => s + parseFloat(a.aandeel), 0)

  function getBijdrage(a: Appartement): number | null {
    if (!dashboard?.bijdrage_per_appartement) return null
    const entry = dashboard.bijdrage_per_appartement.find((b: { id: number }) => b.id === a.id)
    return entry?.bijdrage_per_periode ?? null
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appartementen</h1>
          <p className="text-gray-500 mt-1">Beheer de appartementen en aandelen binnen de VvE</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Appartement toevoegen
        </button>
      </div>

      {/* Aandeel-instellingen */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Aandeel-eenheid</p>
            {shareDenominator > 1 ? (
              <p className="text-sm text-gray-500 mt-0.5">
                Bijdrage wordt berekend als aandeel × €/1/{shareDenominator}&nbsp;deel
                {dashboard?.bijdrage_per_eenheid != null && (
                  <> — nu{' '}
                    <span className="font-medium text-gray-700">
                      {formatCurrency(dashboard.bijdrage_per_eenheid)} per 1/{shareDenominator} deel
                    </span>
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-0.5">
                Bijdrage wordt proportioneel verdeeld op basis van aandeel
              </p>
            )}
          </div>
          {!showDenominatorEdit ? (
            <button
              onClick={() => { setDenominatorInput(String(shareDenominator)); setShowDenominatorEdit(true) }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Pencil size={14} className="inline mr-1" />
              Instellen
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">1/</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={denominatorInput}
                onChange={(e) => setDenominatorInput(e.target.value)}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-sm text-gray-600">deel</span>
              <button
                onClick={() => updateVveMut.mutate(Math.max(1, parseInt(denominatorInput) || 1))}
                className="text-sm bg-primary-600 text-white px-3 py-1 rounded font-medium"
              >
                Opslaan
              </button>
              <button onClick={() => setShowDenominatorEdit(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Appartement-tabel */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Laden…</div>
        ) : appartementen.length === 0 ? (
          <div className="p-12 text-center">
            <Home size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nog geen appartementen</p>
            <p className="text-sm text-gray-400 mt-1">Voeg het eerste appartement toe om te beginnen</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Appartement</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Eigenaar</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  {shareDenominator > 1 ? `Aandelen (×1/${shareDenominator})` : 'Aandeel'}
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Bijdrage per {dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'}
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appartementen.map((a) => {
                const bijdrage = getBijdrage(a)
                const aandeel = parseFloat(a.aandeel)
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{a.naam}</p>
                      {a.nummer && <p className="text-xs text-gray-400">{a.nummer}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.eigenaar_naam ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {shareDenominator > 1
                          ? `${(aandeel * shareDenominator).toFixed(0)}/${shareDenominator}`
                          : aandeel.toFixed(4)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">
                        ({totalAandeel > 0 ? ((aandeel / totalAandeel) * 100).toFixed(1) : '0'}%)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {bijdrage != null ? formatCurrency(bijdrage) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(a)}
                          className="text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Appartement "${a.naam}" verwijderen?`)) deleteMut.mutate(a.id)
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {appartementen.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-6 py-3 text-sm font-medium text-gray-600">Totaal</td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    {shareDenominator > 1
                      ? `${(totalAandeel * shareDenominator).toFixed(0)}/${shareDenominator}`
                      : totalAandeel.toFixed(4)}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    {dashboard?.current_contribution_per_period != null
                      ? formatCurrency(dashboard.current_contribution_per_period)
                      : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Appartement bewerken' : 'Appartement toevoegen'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                <input
                  type="text"
                  required
                  value={form.naam}
                  onChange={(e) => setForm((f) => ({ ...f, naam: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Appartement A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nummer</label>
                <input
                  type="text"
                  value={form.nummer}
                  onChange={(e) => setForm((f) => ({ ...f, nummer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="A01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eigenaar</label>
                <input
                  type="text"
                  value={form.eigenaar_naam}
                  onChange={(e) => setForm((f) => ({ ...f, eigenaar_naam: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Jan de Vries"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aandeel{shareDenominator > 1 ? ` (aantal 1/${shareDenominator} eenheden)` : ''}
                </label>
                <input
                  type="number"
                  required
                  min="0.000001"
                  step="any"
                  value={form.aandeel}
                  onChange={(e) => setForm((f) => ({ ...f, aandeel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={shareDenominator > 1 ? `bijv. 2 (= 2/${shareDenominator})` : '0.5'}
                />
                {shareDenominator > 1 && form.aandeel && (
                  <p className="text-xs text-gray-400 mt-1">
                    = {parseFloat(form.aandeel) || 0}/{shareDenominator} aandeel
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {createMut.isPending || updateMut.isPending ? 'Opslaan…' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
