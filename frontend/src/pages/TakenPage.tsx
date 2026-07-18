import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { ActionItem, Meeting } from '@/types'
import { Check, ClipboardList, Plus, Trash2, Circle } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { toast } from '@/store/toastStore'
import { apiError } from '@/utils/apiError'
import ConfirmDialog from '@/components/ConfirmDialog'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'done'

const STATUS_CFG = {
  open: { label: 'Open', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'Bezig', cls: 'bg-blue-100 text-blue-700' },
  done: { label: 'Klaar', cls: 'bg-green-100 text-green-700' },
}

export default function TakenPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [meetingFilter, setMeetingFilter] = useState<number | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', meeting_id: '' })
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [confirmReset, setConfirmReset] = useState<number | null>(null)

  const { data: tasks = [], isLoading } = useQuery<ActionItem[]>({
    queryKey: ['tasks', vveId],
    queryFn: () => api.get(`/vves/${vveId}/tasks`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ['meetings', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meetings`).then((r) => r.data),
    enabled: !!vveId && isBeheerder,
  })

  const createTask = useMutation({
    mutationFn: () =>
      api.post(`/vves/${vveId}/tasks`, {
        title: form.title,
        description: form.description || undefined,
        due_date: form.due_date || undefined,
        meeting_id: form.meeting_id ? parseInt(form.meeting_id) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', vveId] })
      setForm({ title: '', description: '', due_date: '', meeting_id: '' })
      setShowForm(false)
      toast('Actiepunt aangemaakt')
    },
    onError: (err) => toast(apiError(err, 'Aanmaken mislukt')),
  })

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/vves/${vveId}/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', vveId] }),
    onError: (err) => toast(apiError(err, 'Status bijwerken mislukt')),
  })

  const deleteTask = useMutation({
    mutationFn: (id: number) => api.delete(`/vves/${vveId}/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', vveId] }); toast('Actiepunt verwijderd') },
    onError: (err) => toast(apiError(err, 'Verwijderen mislukt')),
  })

  const byStatus = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  const filtered = meetingFilter === 'all'
    ? byStatus
    : byStatus.filter((t) => t.meeting_id === meetingFilter)
  const counts = {
    open: tasks.filter((t) => t.status === 'open').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  const meetingById = Object.fromEntries(meetings.map((m) => [m.id, m]))

  const cyclicNextStatus = (status: string): string => {
    if (status === 'open') return 'in_progress'
    if (status === 'in_progress') return 'done'
    return 'open'
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actiepunten</h1>
          <p className="text-gray-500 mt-1">Opvolging van besluiten en taken</p>
        </div>
        {isBeheerder && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nieuw actiepunt
          </button>
        )}
      </div>

      {/* Statistieken */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { key: 'open', label: 'Open', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { key: 'in_progress', label: 'Bezig', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { key: 'done', label: 'Afgerond', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
        ].map(({ key, label, color, bg }) => (
          <div key={key} className={`border rounded-xl p-4 ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Vergadering-filter (alleen beheerder ziet vergaderingen) */}
      {isBeheerder && meetings.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-500 shrink-0">Vergadering</label>
          <select
            value={meetingFilter === 'all' ? '' : meetingFilter}
            onChange={(e) => setMeetingFilter(e.target.value ? parseInt(e.target.value) : 'all')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
          >
            <option value="">Alle vergaderingen</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          {meetingFilter !== 'all' && (
            <button onClick={() => setMeetingFilter('all')} className="text-xs text-gray-400 hover:text-gray-600">
              × Wissen
            </button>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          { key: 'all', label: `Alle (${tasks.length})` },
          { key: 'open', label: `Open (${counts.open})` },
          { key: 'in_progress', label: `Bezig (${counts.in_progress})` },
          { key: 'done', label: `Klaar (${counts.done})` },
        ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Actiepuntenlijst */}
      {isLoading && <div className="text-gray-500 text-sm">Laden...</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <ClipboardList className="mx-auto text-gray-400 mb-3" size={32} />
          <p className="text-gray-500">
            {filter === 'all' ? 'Geen actiepunten gevonden.' : `Geen ${STATUS_CFG[filter as keyof typeof STATUS_CFG]?.label.toLowerCase()} actiepunten.`}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((task) => {
          const meeting = task.meeting_id ? meetingById[task.meeting_id] : undefined
          const nextStatus = cyclicNextStatus(task.status)
          const cfg = STATUS_CFG[task.status as keyof typeof STATUS_CFG]
          return (
            <div
              key={task.id}
              className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${
                task.status === 'done' ? 'border-green-100 opacity-70' : 'border-gray-200'
              }`}
            >
              {/* Status toggle */}
              <button
                onClick={() => {
                  if (nextStatus === 'open' && task.status === 'done') {
                    setConfirmReset(task.id)
                  } else {
                    updateTask.mutate({ id: task.id, status: nextStatus })
                  }
                }}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  task.status === 'done'
                    ? 'bg-green-500 border-green-500'
                    : task.status === 'in_progress'
                    ? 'bg-blue-100 border-blue-400'
                    : 'border-gray-300 hover:border-primary-400'
                }`}
                title={`Markeer als ${nextStatus === 'in_progress' ? 'Bezig' : nextStatus === 'done' ? 'Klaar' : 'Heropen'}`}
              >
                {task.status === 'done' && <Check size={13} className="text-white" />}
                {task.status === 'in_progress' && <Circle size={8} className="text-blue-500 fill-blue-500" />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.cls}`}>
                    {cfg?.label}
                  </span>
                </div>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                  {meeting && (
                    <span>
                      Vergadering: {meeting.title} ({format(new Date(meeting.meeting_date), 'd MMM yyyy', { locale: nl })})
                    </span>
                  )}
                  {task.due_date && (
                    <span className={
                      new Date(task.due_date) < new Date() && task.status !== 'done'
                        ? 'text-red-500 font-medium'
                        : ''
                    }>
                      Deadline: {format(new Date(task.due_date), 'd MMM yyyy', { locale: nl })}
                    </span>
                  )}
                  <span>
                    Aangemaakt: {format(new Date(task.created_at), 'd MMM yyyy', { locale: nl })}
                  </span>
                </div>
              </div>

              {/* Status doorbladeren + verwijder */}
              <div className="flex items-center gap-2 shrink-0">
                {isBeheerder && (
                  <button
                    onClick={() => setConfirmDel(task.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: nieuw actiepunt */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Nieuw actiepunt</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Toelichting</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Koppel aan vergadering</label>
                <select
                  value={form.meeting_id}
                  onChange={(e) => setForm((f) => ({ ...f, meeting_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">— geen —</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({format(new Date(m.meeting_date), 'd MMM yyyy', { locale: nl })})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => form.title && createTask.mutate()}
                  disabled={!form.title || createTask.isPending}
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium disabled:opacity-50"
                >
                  Aanmaken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDel !== null && (
        <ConfirmDialog
          message="Actiepunt verwijderen?"
          onConfirm={() => { deleteTask.mutate(confirmDel); setConfirmDel(null) }}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {confirmReset !== null && (
        <ConfirmDialog
          message="Actiepunt terugzetten naar 'Open'?"
          confirmLabel="Heropen"
          danger={false}
          onConfirm={() => { updateTask.mutate({ id: confirmReset, status: 'open' }); setConfirmReset(null) }}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </div>
  )
}
