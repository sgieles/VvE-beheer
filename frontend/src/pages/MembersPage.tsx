import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { User, ContributionPlan, VvE } from '@/types'
import { UserPlus, Pencil, Ban, CheckCircle } from 'lucide-react'

// Zet decimaal aandeel om naar breuk (bijv. 0.4 → "2/5")
function toFraction(decimal: number): string {
  if (!decimal || decimal === 0) return '—'
  const tolerance = 1e-6
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1
  let b = decimal
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b)
    const h = a * h1 + h2
    const k = a * k1 + k2
    h2 = h1; h1 = h
    k2 = k1; k1 = k
    b = 1 / (b - a)
    if (Math.abs(decimal - h1 / k1) < tolerance) break
  }
  return `${h1}/${k1}`
}

function formatEur(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function MembersPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const { data: members = [], isLoading } = useQuery<User[]>({
    queryKey: ['members', vveId],
    queryFn: () => api.get(`/vves/${vveId}/members`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: vve } = useQuery<VvE>({
    queryKey: ['vve', vveId],
    queryFn: () => api.get(`/vves/${vveId}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: contributions = [] } = useQuery<ContributionPlan[]>({
    queryKey: ['contributions', vveId],
    queryFn: () => api.get(`/vves/${vveId}/financial/contributions`).then((r) => r.data),
    enabled: !!vveId,
  })

  // Huidig bijdrageplan: meest recente met effective_from <= vandaag
  const today = new Date().toISOString().slice(0, 10)
  const currentPlan = contributions
    .filter((p) => p.effective_from <= today)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]

  const frequency = vve?.contribution_frequency ?? 'monthly'
  const frequencyLabel = frequency === 'monthly' ? 'maand' : 'kwartaal'

  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete(`/vves/${vveId}/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', vveId] }),
  })

  if (isLoading) return <div className="p-8 text-gray-500">Laden...</div>

  const totalAandeel = members.reduce((sum, m) => sum + (m.aandeel ? parseFloat(m.aandeel) : 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ledenbeheer</h1>
          <p className="text-gray-500 mt-1">
            {members.length} leden &bull; Totaal aandeel: {toFraction(totalAandeel)}
            {currentPlan && (
              <span className="ml-2 text-gray-400">
                &bull; Bijdrage per {frequencyLabel}: {formatEur(parseFloat(currentPlan.amount_per_period))}
              </span>
            )}
          </p>
        </div>
        {isBeheerder && (
          <button
            onClick={() => { setEditUser(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <UserPlus size={16} />
            Lid toevoegen
          </button>
        )}
      </div>

      {/* Scrollbare tabel */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Naam', 'Gebruikersnaam', 'E-mail', 'Adres', 'App. nr.', 'Aandeel', `Bijdrage / ${frequencyLabel}`, 'Rol', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const aandeel = m.aandeel ? parseFloat(m.aandeel) : null
              const bijdrage = aandeel && currentPlan
                ? aandeel * parseFloat(currentPlan.amount_per_period)
                : null

              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-medium text-gray-900 whitespace-nowrap">{m.full_name ?? '—'}</td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{m.username}</td>
                  <td className="px-4 py-4 text-gray-600">{m.email}</td>
                  <td className="px-4 py-4 text-gray-600 max-w-[180px] truncate" title={m.address ?? ''}>
                    {m.address ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{m.appartement_nummer ?? '—'}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {aandeel ? (
                      <div>
                        <span className="font-semibold text-gray-900">{toFraction(aandeel)}</span>
                        <span className="text-gray-400 text-xs ml-1">({(aandeel * 100).toFixed(1)}%)</span>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {bijdrage != null ? (
                      <span className="font-medium text-gray-900">{formatEur(bijdrage)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      m.role === 'beheerder' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {m.role === 'beheerder' ? 'Beheerder' : 'Eigenaar'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {m.is_active
                      ? <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Actief</span>
                      : <span className="text-gray-400 text-sm">Inactief</span>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {isBeheerder && m.id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditUser(m); setShowForm(true) }}
                          className="text-gray-400 hover:text-primary-600 transition-colors"
                          title="Bewerken"
                        >
                          <Pencil size={16} />
                        </button>
                        {m.is_active && (
                          <button
                            onClick={() => deactivate.mutate(m.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Deactiveren"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <MemberForm
          vveId={vveId!}
          editUser={editUser}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['members', vveId] }) }}
        />
      )}
    </div>
  )
}

function MemberForm({ vveId, editUser, onClose, onSaved }: {
  vveId: number; editUser: User | null; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    username: editUser?.username ?? '',
    email: editUser?.email ?? '',
    full_name: editUser?.full_name ?? '',
    password: '',
    role: editUser?.role ?? 'eigenaar',
    aandeel: editUser?.aandeel ? (parseFloat(editUser.aandeel) * 100).toString() : '',
    appartement_nummer: editUser?.appartement_nummer ?? '',
    address: editUser?.address ?? '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...form,
        aandeel: form.aandeel ? (parseFloat(form.aandeel) / 100).toString() : null,
      }
      if (editUser) {
        await api.patch(`/vves/${vveId}/members/${editUser.id}`, payload)
      } else {
        await api.post(`/vves/${vveId}/members`, payload)
      }
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Er is een fout opgetreden')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{editUser ? 'Lid bewerken' : 'Lid toevoegen'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volledige naam</label>
              <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Appartementsrecht nr.</label>
              <input type="text" value={form.appartement_nummer} onChange={(e) => setForm((f) => ({ ...f, appartement_nummer: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adres woning</label>
            <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="bijv. Zonnelaan 1A, 1234 AB Amsterdam" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gebruikersnaam {!editUser && '*'}</label>
              <input type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required={!editUser} disabled={!!editUser}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres {!editUser && '*'}</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required={!editUser}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          </div>

          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord *</label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                <option value="eigenaar">Eigenaar</option>
                <option value="beheerder">Beheerder</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aandeel (%)</label>
              <input type="number" min="0" max="100" step="0.0001" value={form.aandeel}
                onChange={(e) => setForm((f) => ({ ...f, aandeel: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="bijv. 33.333" />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
              Annuleren
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              {editUser ? 'Opslaan' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
