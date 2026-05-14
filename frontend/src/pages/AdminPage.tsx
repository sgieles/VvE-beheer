import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import api from '@/services/api'
import type { VvE, User } from '@/types'
import { Building2, Plus, Users, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react'

export default function AdminPage() {
  const { user, setActiveVve } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNewVvE, setShowNewVvE] = useState(false)
  const [assignModal, setAssignModal] = useState<VvE | null>(null)

  if (user?.role !== 'platform_admin') {
    return <div className="p-8 text-gray-500">Geen toegang.</div>
  }

  const { data: vves = [], isLoading } = useQuery<VvE[]>({
    queryKey: ['vves'],
    queryFn: () => api.get('/vves').then((r) => r.data),
  })

  const handleSwitchTo = (vve: VvE) => {
    setActiveVve(vve)
    navigate('/')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-amber-500" size={24} />
            Admin overzicht
          </h1>
          <p className="text-gray-500 mt-1">{vves.length} VvE's op het platform</p>
        </div>
        <button
          onClick={() => setShowNewVvE(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
        >
          <Plus size={16} /> Nieuwe VvE aanmaken
        </button>
      </div>

      {isLoading && <div className="text-gray-500">Laden...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {vves.map((vve) => (
          <VvECard
            key={vve.id}
            vve={vve}
            onSwitchTo={() => handleSwitchTo(vve)}
            onAssignBeheerder={() => setAssignModal(vve)}
          />
        ))}
      </div>

      {showNewVvE && (
        <NewVvEModal
          onClose={() => setShowNewVvE(false)}
          onSaved={() => { setShowNewVvE(false); qc.invalidateQueries({ queryKey: ['vves'] }) }}
        />
      )}

      {assignModal && (
        <AssignBeheerderModal
          vve={assignModal}
          onClose={() => setAssignModal(null)}
          onSaved={() => { setAssignModal(null); qc.invalidateQueries({ queryKey: ['vves'] }) }}
        />
      )}
    </div>
  )
}

function VvECard({ vve, onSwitchTo, onAssignBeheerder }: {
  vve: VvE; onSwitchTo: () => void; onAssignBeheerder: () => void
}) {
  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['members', vve.id],
    queryFn: () => api.get(`/vves/${vve.id}/members`).then((r) => r.data),
  })

  const beheerders = members.filter((m) => m.role === 'beheerder')
  const eigenaren = members.filter((m) => m.role === 'eigenaar')

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary-50 rounded-lg p-2 shrink-0">
          <Building2 className="text-primary-600" size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{vve.name}</h2>
          {vve.address && <p className="text-sm text-gray-500 truncate">{vve.address}</p>}
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            Bijdrage: per {vve.contribution_frequency === 'monthly' ? 'maand' : 'kwartaal'}
          </p>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-gray-600">
          <ShieldCheck size={14} className="text-amber-500" />
          <span>{beheerders.length} beheerder{beheerders.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Users size={14} />
          <span>{eigenaren.length} eigenaar{eigenaren.length !== 1 ? 'en' : ''}</span>
        </div>
      </div>

      {beheerders.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          {beheerders.map((b) => b.full_name ?? b.username).join(', ')}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onAssignBeheerder}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-lg transition-colors"
        >
          <UserCheck size={14} /> Beheerder toewijzen
        </button>
        <button
          onClick={onSwitchTo}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors font-medium"
        >
          Beheren <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

function NewVvEModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    kvk_number: '',
    contribution_frequency: 'monthly',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/vves', form)
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Er is een fout opgetreden')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Nieuwe VvE aanmaken</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. VvE Parkzicht" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
            <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KvK-nummer</label>
            <input type="text" value={form.kvk_number} onChange={(e) => setForm((f) => ({ ...f, kvk_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bijdragefrequentie</label>
            <select value={form.contribution_frequency} onChange={(e) => setForm((f) => ({ ...f, contribution_frequency: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
              <option value="monthly">Maandelijks</option>
              <option value="quarterly">Per kwartaal</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">Aanmaken</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignBeheerderModal({ vve, onClose, onSaved }: {
  vve: VvE; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    username: '', email: '', full_name: '', password: '',
  })
  const [existingUserId, setExistingUserId] = useState('')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  // Alle gebruikers om een bestaande beheerder te kunnen koppelen
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['all-users'],
    queryFn: () => api.get(`/vves/${vve.id}/members`).then((r) => r.data),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'new') {
        // Maak nieuw lid aan als beheerder
        const newUser = await api.post(`/vves/${vve.id}/members`, {
          ...form, role: 'beheerder',
        })
        await api.post(`/vves/${vve.id}/assign-beheerder/${newUser.data.id}`)
      } else {
        // Koppel bestaand lid
        await api.post(`/vves/${vve.id}/assign-beheerder/${existingUserId}`)
      }
      qc.invalidateQueries({ queryKey: ['members', vve.id] })
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Er is een fout opgetreden')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">Beheerder toewijzen</h2>
        <p className="text-sm text-gray-500 mb-4">{vve.name}</p>

        <div className="flex gap-2 mb-4">
          {['new', 'existing'].map((m) => (
            <button key={m} onClick={() => setMode(m as 'new' | 'existing')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${mode === m ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {m === 'new' ? 'Nieuw account' : 'Bestaand lid'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'new' ? (
            <>
              <input type="text" placeholder="Volledige naam" required value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <input type="text" placeholder="Gebruikersnaam *" required value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <input type="email" placeholder="E-mailadres *" required value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <input type="password" placeholder="Wachtwoord *" required value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </>
          ) : (
            <select value={existingUserId} onChange={(e) => setExistingUserId(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
              <option value="">Selecteer een lid…</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name ?? u.username} ({u.role})</option>
              ))}
            </select>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">Toewijzen</button>
          </div>
        </form>
      </div>
    </div>
  )
}
