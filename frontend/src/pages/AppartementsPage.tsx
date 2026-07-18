import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Appartement, VvE } from '@/types'
import { Plus, Pencil, Trash2, X, Home, Power, AlertTriangle } from 'lucide-react'
import { toast } from '@/store/toastStore'
import { apiError } from '@/utils/apiError'
import ConfirmDialog from '@/components/ConfirmDialog'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

interface AppartementForm {
  naam: string
  nummer: string
  eigenaar_naam: string
  aandeel: string
}

const emptyForm: AppartementForm = { naam: '', nummer: '', eigenaar_naam: '', aandeel: '1' }

export default function AppartementsPage() {
  const { activeVveId, activeVve, setActiveVve } = useAuthStore()
  const vveId = activeVveId
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Appartement | null>(null)
  const [form, setForm] = useState<AppartementForm>(emptyForm)
  const [error, setError] = useState('')

  const [confirmDelApp, setConfirmDelApp] = useState<Appartement | null>(null)

  // Denominator edit
  const [showDenomEdit, setShowDenomEdit] = useState(false)
  const [denomInput, setDenomInput] = useState('')
  const [confirmDenom, setConfirmDenom] = useState<number | null>(null)

  // Bijdrage per eenheid edit
  const [showBijdrageEdit, setShowBijdrageEdit] = useState(false)
  const [bijdrageInput, setBijdrageInput] = useState('')
  const [bijdrageDatum, setBijdrageDatum] = useState(today())

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
      toast('Appartement toegevoegd')
    },
    onError: (err) => setError(apiError(err, 'Opslaan mislukt')),
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
      toast('Wijzigingen opgeslagen')
    },
    onError: (err) => setError(apiError(err, 'Opslaan mislukt')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/vves/${vveId}/appartementen/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appartementen', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      toast('Appartement verwijderd')
    },
    onError: (err) => toast(apiError(err, 'Verwijderen mislukt')),
  })

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/vves/${vveId}/appartementen/${id}`, { is_active }),
    onSuccess: (_, { is_active }) => {
      qc.invalidateQueries({ queryKey: ['appartementen', vveId] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      toast(is_active ? 'Appartement geactiveerd' : 'Appartement gedeactiveerd')
    },
    onError: (err) => toast(apiError(err, 'Status wijzigen mislukt')),
  })

  const updateVveMut = useMutation({
    mutationFn: (share_denominator: number) =>
      api.patch(`/vves/${vveId}`, {
        name: activeVve?.name ?? 'Mijn VvE',
        contribution_frequency: activeVve?.contribution_frequency ?? 'monthly',
        share_denominator,
      }),
    onSuccess: (res) => {
      setActiveVve(res.data)
      qc.invalidateQueries({ queryKey: ['vves'] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setShowDenomEdit(false)
      setConfirmDenom(null)
      toast('Aandeel-noemer bijgewerkt')
    },
    onError: (err) => toast(apiError(err, 'Opslaan mislukt')),
  })

  const createBijdrageMut = useMutation({
    mutationFn: ({ amount, datum }: { amount: number; datum: string }) =>
      api.post(`/vves/${vveId}/financial/contributions`, {
        amount_per_period: amount,
        effective_from: datum,
        notes: `${(amount / shareDenominator).toFixed(2).replace('.', ',')} per 1/${shareDenominator} aandeel per ${periodeLabel}`,
      }),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ['dashboard', vveId] })
      qc.invalidateQueries({ queryKey: ['contributions', vveId] })
      setShowBijdrageEdit(false)
      toast('Bijdrage opgeslagen')
    },
    onError: (err) => toast(apiError(err, 'Opslaan mislukt')),
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
      aandeel: String(parseFloat(a.aandeel)),
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
    const aandeel = parseFloat(form.aandeel)
    if (isNaN(aandeel) || aandeel <= 0) {
      setError('Voer een geldig aandeel in (groter dan 0)')
      return
    }
    if (shareDenominator > 1 && aandeel > shareDenominator) {
      setError(`Teller (${aandeel}) mag de noemer niet overschrijden (max: ${shareDenominator})`)
      return
    }
    const huidigeAandelen = editing
      ? totalAandeel - parseFloat(editing.aandeel)
      : totalAandeel
    if (shareDenominator > 1 && huidigeAandelen + aandeel > shareDenominator) {
      setError(`Totaal aandeel wordt ${(huidigeAandelen + aandeel).toFixed(0)}/${shareDenominator} — dit overschrijdt de noemer. Pas de noemer aan of verlaag het aandeel.`)
      return
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
    } else {
      createMut.mutate(form)
    }
  }

  function openBijdrageEdit() {
    const current = dashboard?.bijdrage_per_eenheid
      ?? (dashboard?.current_contribution_per_period
        ? dashboard.current_contribution_per_period / shareDenominator
        : 0)
    setBijdrageInput(current.toFixed(2))
    setBijdrageDatum(today())
    setShowBijdrageEdit(true)
  }

  const shareDenominator: number = (activeVve as VvE | undefined)?.share_denominator ?? 1
  const periodeLabel = dashboard?.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'
  const totalAandeel = appartementen.reduce((s, a) => s + parseFloat(a.aandeel), 0)

  function getBijdrage(a: Appartement): number | null {
    if (!dashboard?.bijdrage_per_appartement) return null
    const entry = dashboard.bijdrage_per_appartement.find((b: { id: number }) => b.id === a.id)
    return entry?.bijdrage_per_periode ?? null
  }

  const bijdrageTotal = parseFloat(bijdrageInput) * shareDenominator

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

      {/* Instellingen */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
        {/* Bijdrage per eenheid */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-gray-900">
              Bijdrage per 1/{shareDenominator} aandeel
            </p>
            {dashboard?.bijdrage_per_eenheid != null ? (
              <p className="text-sm text-gray-500 mt-0.5">
                {formatCurrency(dashboard.bijdrage_per_eenheid)} per 1/{shareDenominator} deel per {periodeLabel}
                <span className="text-gray-400 ml-1">
                  (totaal {formatCurrency(dashboard.current_contribution_per_period)}/{periodeLabel})
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-0.5">Nog niet ingesteld</p>
            )}
          </div>
          {!showBijdrageEdit ? (
            <button
              onClick={openBijdrageEdit}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium shrink-0"
            >
              <Pencil size={14} className="inline mr-1" />
              Wijzigen
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-sm text-gray-600">€</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={bijdrageInput}
                onChange={(e) => setBijdrageInput(e.target.value)}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
              />
              <span className="text-sm text-gray-600">per 1/{shareDenominator} / {periodeLabel}</span>
              {bijdrageInput && (
                <span className="text-xs text-gray-400">= {formatCurrency(bijdrageTotal)}/totaal</span>
              )}
              <input
                type="date"
                value={bijdrageDatum}
                onChange={(e) => setBijdrageDatum(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={() => createBijdrageMut.mutate({ amount: bijdrageTotal, datum: bijdrageDatum })}
                disabled={!bijdrageInput || isNaN(bijdrageTotal) || bijdrageTotal <= 0}
                className="text-sm bg-primary-600 text-white px-3 py-1 rounded font-medium disabled:opacity-40"
              >
                Opslaan
              </button>
              <button onClick={() => setShowBijdrageEdit(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        <hr className="border-gray-100" />

        {/* Noemer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Aandeel-noemer</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Aandelen worden uitgedrukt als X/{shareDenominator}
            </p>
          </div>
          {!showDenomEdit ? (
            <button
              onClick={() => { setDenomInput(String(shareDenominator)); setShowDenomEdit(true) }}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium shrink-0"
            >
              <Pencil size={14} className="inline mr-1" />
              Aanpassen
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Noemer:</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={denomInput}
                  onChange={(e) => setDenomInput(e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={() => setConfirmDenom(Math.max(1, parseInt(denomInput) || 1))}
                  disabled={!denomInput || parseInt(denomInput) < 1}
                  className="text-sm bg-primary-600 text-white px-3 py-1 rounded font-medium disabled:opacity-40"
                >
                  Opslaan
                </button>
                <button onClick={() => setShowDenomEdit(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              {denomInput && parseInt(denomInput) > 0 && parseInt(denomInput) !== shareDenominator && dashboard?.current_contribution_per_period && appartementen.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-800 font-medium mb-1.5">
                    <AlertTriangle size={13} />
                    Impact op bijdragen (noemer {shareDenominator} → {parseInt(denomInput)})
                  </div>
                  <div className="space-y-0.5">
                    {appartementen.filter((a) => a.is_active).map((a) => {
                      const nieuweDenom = parseInt(denomInput)
                      const oudBij = (parseFloat(a.aandeel) / shareDenominator) * dashboard.current_contribution_per_period
                      const nieuwBij = (parseFloat(a.aandeel) / nieuweDenom) * dashboard.current_contribution_per_period
                      return (
                        <div key={a.id} className="flex justify-between text-amber-700">
                          <span>{a.naam}</span>
                          <span>{formatCurrency(oudBij)} → <span className="font-medium">{formatCurrency(nieuwBij)}</span></span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Appartement</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Eigenaar</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Aandeel
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Bijdrage per {periodeLabel}
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appartementen.map((a) => {
                const bijdrage = getBijdrage(a)
                const aandeel = parseFloat(a.aandeel)
                const isActive = a.is_active !== false
                return (
                  <tr key={a.id} className={`hover:bg-gray-50 ${!isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{a.naam}</p>
                      {a.nummer && <p className="text-xs text-gray-400">{a.nummer}</p>}
                      {!isActive && <span className="text-xs text-red-500 font-medium">Inactief</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{a.eigenaar_naam ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {shareDenominator > 1
                          ? `${aandeel.toFixed(0)}/${shareDenominator}`
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
                          onClick={() => toggleActiveMut.mutate({ id: a.id, is_active: !isActive })}
                          title={isActive ? 'Deactiveren' : 'Activeren'}
                          className={`transition-colors ${isActive ? 'text-gray-400 hover:text-amber-500' : 'text-red-400 hover:text-green-500'}`}
                        >
                          <Power size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(a)}
                          className="text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelApp(a)}
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
                      ? `${totalAandeel.toFixed(0)}/${shareDenominator}`
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
          </div>
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
                  placeholder="Kinderdijkstraat 57-H"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nummer</label>
                <input
                  type="text"
                  value={form.nummer}
                  onChange={(e) => setForm((f) => ({ ...f, nummer: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="57-H"
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
                  Aandeel{shareDenominator > 1 ? ` (teller — noemer is ${shareDenominator})` : ''}
                </label>
                <input
                  type="number"
                  required
                  min="0.000001"
                  step="any"
                  value={form.aandeel}
                  onChange={(e) => setForm((f) => ({ ...f, aandeel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={shareDenominator > 1 ? '3' : '0.5'}
                />
                {shareDenominator > 1 && (() => {
                  const teller = parseFloat(form.aandeel) || 0
                  const huidigeAandelen = editing ? totalAandeel - parseFloat(editing.aandeel) : totalAandeel
                  const nieuwTotaal = huidigeAandelen + teller
                  const overschrijdt = teller > 0 && nieuwTotaal > shareDenominator
                  return (
                    <>
                      <p className="text-xs text-gray-400 mt-1">
                        = {teller}/{shareDenominator} aandeel
                        {dashboard?.bijdrage_per_eenheid != null && teller > 0 && (
                          <> — bijdrage: {formatCurrency(teller * dashboard.bijdrage_per_eenheid)}/{periodeLabel}</>
                        )}
                      </p>
                      {overschrijdt && (
                        <p className="text-xs text-amber-600 mt-1">
                          Totaal wordt {nieuwTotaal.toFixed(0)}/{shareDenominator} — noemer wordt overschreden
                        </p>
                      )}
                      {!overschrijdt && teller > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Resterend na opslaan: {(shareDenominator - nieuwTotaal).toFixed(0)}/{shareDenominator}
                        </p>
                      )}
                    </>
                  )
                })()}
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

      {confirmDelApp && (
        <ConfirmDialog
          message={`Appartement "${confirmDelApp.naam}" definitief verwijderen?`}
          onConfirm={() => { deleteMut.mutate(confirmDelApp.id); setConfirmDelApp(null) }}
          onCancel={() => setConfirmDelApp(null)}
        />
      )}

      {confirmDenom !== null && (
        <ConfirmDialog
          message={`Aandeel-noemer wijzigen van ${shareDenominator} naar ${confirmDenom}? Dit herberekent de bijdrage per appartement.`}
          confirmLabel="Wijzigen"
          danger={false}
          onConfirm={() => updateVveMut.mutate(confirmDenom)}
          onCancel={() => setConfirmDenom(null)}
        />
      )}
    </div>
  )
}
