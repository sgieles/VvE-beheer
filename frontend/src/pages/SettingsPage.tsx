import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { VvE } from '@/types'
import { Save, Lock } from 'lucide-react'

type Tab = 'vve' | 'profiel'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const [tab, setTab] = useState<Tab>(isBeheerder ? 'vve' : 'profiel')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Instellingen</h1>
        <p className="text-gray-500 mt-1">VvE-gegevens en persoonlijk profiel beheren</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8">
        {isBeheerder && (
          <button
            onClick={() => setTab('vve')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'vve' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            VvE-gegevens
          </button>
        )}
        <button
          onClick={() => setTab('profiel')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'profiel' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Mijn profiel
        </button>
      </div>

      {tab === 'vve' && isBeheerder && <VvETab />}
      {tab === 'profiel' && <ProfielTab />}
    </div>
  )
}

function VvETab() {
  const { activeVveId } = useAuthStore()
  const vveId = activeVveId
  const qc = useQueryClient()

  const { data: vve } = useQuery<VvE>({
    queryKey: ['vve', vveId],
    queryFn: () => api.get(`/vves/${vveId}`).then((r) => r.data),
    enabled: !!vveId,
  })

  const [form, setForm] = useState({
    name: '',
    address: '',
    kvk_number: '',
    contribution_frequency: 'monthly',
    share_denominator: 1,
  })
  const [initialized, setInitialized] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (vve && !initialized) {
    setForm({
      name: vve.name,
      address: vve.address ?? '',
      kvk_number: vve.kvk_number ?? '',
      contribution_frequency: vve.contribution_frequency,
      share_denominator: vve.share_denominator,
    })
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/vves/${vveId}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vve', vveId] })
      qc.invalidateQueries({ queryKey: ['vves'] })
      qc.invalidateQueries({ queryKey: ['dashboard', vveId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Opslaan mislukt')
    },
  })

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">VvE-gegevens</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naam VvE *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Kinderdijkstraat 57-63, Amsterdam"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KvK-nummer</label>
            <input
              type="text"
              value={form.kvk_number}
              onChange={(e) => setForm((f) => ({ ...f, kvk_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. 12345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bijdrage-frequentie</label>
            <select
              value={form.contribution_frequency}
              onChange={(e) => setForm((f) => ({ ...f, contribution_frequency: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
            >
              <option value="monthly">Maandelijks</option>
              <option value="quarterly">Per kwartaal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aandeel-noemer
              <span className="ml-1 text-xs text-gray-400 font-normal">(totaal aantal breukdelen, bijv. 32)</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.share_denominator}
              onChange={(e) => setForm((f) => ({ ...f, share_denominator: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Opslaan…' : 'Opslaan'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Opgeslagen</span>}
        </div>
      </div>
    </div>
  )
}

function ProfielTab() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name ?? '',
    email: user?.email ?? '',
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')

  const saveProfile = useMutation({
    mutationFn: () => api.patch('/auth/me', {
      full_name: profileForm.full_name || null,
      email: profileForm.email,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      setProfileSaved(true)
      setProfileError('')
      setTimeout(() => setProfileSaved(false), 2500)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setProfileError(msg ?? 'Opslaan mislukt')
    },
  })

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/me/password', {
      current_password: pwForm.current_password,
      new_password: pwForm.new_password,
    }),
    onSuccess: () => {
      setPwSaved(true)
      setPwError('')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      setTimeout(() => setPwSaved(false), 2500)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPwError(msg ?? 'Wachtwoord wijzigen mislukt')
    },
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Nieuwe wachtwoorden komen niet overeen')
      return
    }
    if (pwForm.new_password.length < 8) {
      setPwError('Nieuw wachtwoord moet minimaal 8 tekens zijn')
      return
    }
    changePassword.mutate()
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profiel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Persoonlijke gegevens</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gebruikersnaam</label>
            <input
              type="text"
              value={user?.username ?? ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Gebruikersnaam kan niet worden gewijzigd</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volledige naam</label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Jan de Vries"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>
        {profileError && <p className="text-red-600 text-sm mt-3">{profileError}</p>}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            {saveProfile.isPending ? 'Opslaan…' : 'Opslaan'}
          </button>
          {profileSaved && <span className="text-sm text-green-600 font-medium">Opgeslagen</span>}
        </div>
      </div>

      {/* Wachtwoord */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Lock size={16} className="text-gray-500" />
          Wachtwoord wijzigen
        </h2>
        <p className="text-sm text-gray-400 mb-5">Laat leeg als u het wachtwoord niet wil wijzigen</p>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Huidig wachtwoord *</label>
            <input
              type="password"
              value={pwForm.current_password}
              onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord *</label>
            <input
              type="password"
              value={pwForm.new_password}
              onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              autoComplete="new-password"
              placeholder="Minimaal 8 tekens"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bevestig nieuw wachtwoord *</label>
            <input
              type="password"
              value={pwForm.confirm_password}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm_password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              autoComplete="new-password"
            />
          </div>
          {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={changePassword.isPending || !pwForm.current_password || !pwForm.new_password}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Lock size={15} />
              {changePassword.isPending ? 'Wijzigen…' : 'Wachtwoord wijzigen'}
            </button>
            {pwSaved && <span className="text-sm text-green-600 font-medium">Wachtwoord gewijzigd</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
