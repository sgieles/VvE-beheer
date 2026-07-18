import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { Meeting, AgendaItem, MeetingMinutes, ActionItem } from '@/types'
import { toast } from '@/store/toastStore'
import {
  Plus, CalendarPlus, ListChecks, Check, Video,
  ChevronDown, ChevronUp, CheckCircle2, Trash2, Pencil, Upload, ArrowRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function MeetingsPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()

  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [showAgendaForm, setShowAgendaForm] = useState(false)
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null)
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null)
  const [confirmDel, setConfirmDel] = useState<Meeting | null>(null)

  const deleteMeeting = useMutation({
    mutationFn: (meetingId: number) => api.delete(`/vves/${vveId}/meetings/${meetingId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings', vveId] }); toast('Vergadering verwijderd') },
  })

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['meetings', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meetings`).then((r) => r.data),
    enabled: !!vveId,
  })

  const { data: pendingItems = [] } = useQuery<AgendaItem[]>({
    queryKey: ['agenda-pending', vveId],
    queryFn: () => api.get(`/vves/${vveId}/meetings/agenda/pending`).then((r) => r.data),
    enabled: !!vveId,
  })

  const createTeams = useMutation({
    mutationFn: (meetingId: number) =>
      api.post(`/vves/${vveId}/meetings/${meetingId}/create-teams-meeting`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings', vveId] }),
  })

  const compilAgenda = useMutation({
    mutationFn: (meetingId: number) =>
      api.post(`/vves/${vveId}/meetings/${meetingId}/agenda/compile`),
    onSuccess: (_, meetingId) => {
      qc.invalidateQueries({ queryKey: ['agenda-pending', vveId] })
      qc.invalidateQueries({ queryKey: ['agenda', vveId, meetingId] })
    },
  })

  const upcoming = meetings.filter((m) => m.status === 'planned' && new Date(m.meeting_date) > new Date())
  const past = meetings.filter((m) => m.status !== 'planned' || new Date(m.meeting_date) <= new Date())

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vergaderingen</h1>
          <p className="text-gray-500 mt-1">Agenda, notulen en actiepunten</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAgendaForm(true)}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <ListChecks size={16} />
            Agendapunt indienen
            {pendingItems.length > 0 && (
              <span className="bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {pendingItems.length}
              </span>
            )}
          </button>
          {isBeheerder && (
            <button
              onClick={() => setShowNewMeeting(true)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <CalendarPlus size={16} />
              Vergadering aanmaken
            </button>
          )}
        </div>
      </div>

      {isBeheerder && pendingItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-2 text-blue-700">
          <ListChecks size={18} />
          <span className="text-sm font-medium">
            {pendingItems.length} agendapunt(en) wachten op toewijzing aan een vergadering
          </span>
        </div>
      )}

      {isLoading && <div className="text-gray-500">Laden...</div>}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aankomend</h2>
          <div className="space-y-4">
            {upcoming.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                vveId={vveId!}
                isBeheerder={isBeheerder}
                pendingCount={pendingItems.length}
                expanded={expandedMeeting === m.id}
                onToggle={() => setExpandedMeeting(expandedMeeting === m.id ? null : m.id)}
                onCreateTeams={() => createTeams.mutate(m.id)}
                onCompileAgenda={() => compilAgenda.mutate(m.id)}
                onEdit={() => setEditMeeting(m)}
                onDelete={() => setConfirmDel(m)}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Eerdere vergaderingen</h2>
          <div className="space-y-4">
            {past.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                vveId={vveId!}
                isBeheerder={isBeheerder}
                pendingCount={0}
                expanded={expandedMeeting === m.id}
                onToggle={() => setExpandedMeeting(expandedMeeting === m.id ? null : m.id)}
                onCreateTeams={() => {}}
                onCompileAgenda={() => {}}
                onEdit={() => setEditMeeting(m)}
                onDelete={() => setConfirmDel(m)}
              />
            ))}
          </div>
        </section>
      )}

      {meetings.length === 0 && !isLoading && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <CalendarPlus className="mx-auto text-gray-400 mb-3" size={32} />
          <p className="text-gray-500">Nog geen vergaderingen gepland.</p>
        </div>
      )}

      {showNewMeeting && (
        <NewMeetingModal
          vveId={vveId!}
          onClose={() => setShowNewMeeting(false)}
          onSaved={() => { setShowNewMeeting(false); qc.invalidateQueries({ queryKey: ['meetings', vveId] }) }}
        />
      )}
      {editMeeting && (
        <EditMeetingModal
          vveId={vveId!}
          meeting={editMeeting}
          onClose={() => setEditMeeting(null)}
          onSaved={() => { setEditMeeting(null); qc.invalidateQueries({ queryKey: ['meetings', vveId] }) }}
        />
      )}
      {showAgendaForm && (
        <AgendaItemModal
          vveId={vveId!}
          onClose={() => setShowAgendaForm(false)}
          onSaved={() => { setShowAgendaForm(false); qc.invalidateQueries({ queryKey: ['agenda-pending', vveId] }) }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Vergadering "${confirmDel.title}" verwijderen? Agenda en notulen gaan ook verloren.`}
          onConfirm={() => { deleteMeeting.mutate(confirmDel.id); setConfirmDel(null) }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

type Tab = 'agenda' | 'notulen' | 'acties'

function MeetingCard({ meeting, vveId, isBeheerder, pendingCount, expanded, onToggle, onCreateTeams, onCompileAgenda, onEdit, onDelete }: {
  meeting: Meeting; vveId: number; isBeheerder: boolean; pendingCount: number
  expanded: boolean; onToggle: () => void; onCreateTeams: () => void; onCompileAgenda: () => void
  onEdit: () => void; onDelete: () => void
}) {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('agenda')
  const isUpcoming = meeting.status === 'planned' && new Date(meeting.meeting_date) > new Date()

  const { data: agenda = [] } = useQuery<AgendaItem[]>({
    queryKey: ['agenda', vveId, meeting.id],
    queryFn: () => api.get(`/vves/${vveId}/meetings/${meeting.id}/agenda`).then((r) => r.data),
    enabled: expanded && activeTab === 'agenda',
  })

  const { data: minutes = [] } = useQuery<MeetingMinutes[]>({
    queryKey: ['minutes', vveId, meeting.id],
    queryFn: () => api.get(`/vves/${vveId}/meetings/${meeting.id}/minutes`).then((r) => r.data),
    enabled: expanded && activeTab === 'notulen',
  })

  const { data: tasks = [] } = useQuery<ActionItem[]>({
    queryKey: ['tasks', vveId, meeting.id],
    queryFn: () => api.get(`/vves/${vveId}/tasks?meeting_id=${meeting.id}`).then((r) => r.data),
    enabled: expanded && activeTab === 'acties',
  })

  const STANDAARD_AGENDA = [
    { title: 'Opening en stemopname', description: 'Vaststellen aanwezigen en quorum' },
    { title: 'Notulen vorige vergadering', description: 'Vaststellen en ondertekenen' },
    { title: 'Ingekomen stukken en mededelingen', description: null },
    { title: 'Financiën', description: 'Balans, begroting en reservefonds' },
    { title: 'MJOP-voortgang', description: 'Onderhoudsstatus en planning' },
    { title: 'Rondvraag', description: null },
    { title: 'Sluiting', description: null },
  ]

  const [addingStdAgenda, setAddingStdAgenda] = useState(false)
  const addStandardAgenda = async () => {
    setAddingStdAgenda(true)
    try {
      for (const item of STANDAARD_AGENDA) {
        await api.post(`/vves/${vveId}/meetings/agenda`, { meeting_id: meeting.id, ...item })
      }
      await api.post(`/vves/${vveId}/meetings/${meeting.id}/agenda/compile`)
      qc.invalidateQueries({ queryKey: ['agenda', vveId, meeting.id] })
      toast('Standaard agenda toegevoegd')
    } catch {
      toast('Fout bij toevoegen standaard agenda')
    } finally {
      setAddingStdAgenda(false)
    }
  }

  const approveMinutes = useMutation({
    mutationFn: (minutesId: number) =>
      api.post(`/vves/${vveId}/meetings/${meeting.id}/minutes/${minutesId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['minutes', vveId, meeting.id] }),
  })

  const updateStatus = useMutation({
    mutationFn: (newStatus: string) =>
      api.patch(`/vves/${vveId}/meetings/${meeting.id}`, { status: newStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings', vveId] }),
  })

  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: string }) =>
      api.patch(`/vves/${vveId}/tasks/${taskId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', vveId, meeting.id] }),
  })

  const deleteTask = useMutation({
    mutationFn: (taskId: number) => api.delete(`/vves/${vveId}/tasks/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', vveId, meeting.id] }),
  })

  const statusBadge =
    meeting.status === 'completed'
      ? { label: 'Afgerond', cls: 'bg-green-100 text-green-700' }
      : meeting.status === 'in_progress'
      ? { label: 'In behandeling', cls: 'bg-blue-100 text-blue-700' }
      : null

  const tabs: { key: Tab; label: string }[] = [
    { key: 'agenda', label: `Agenda${agenda.length > 0 ? ` (${agenda.length})` : ''}` },
    { key: 'notulen', label: 'Notulen' },
    { key: 'acties', label: `Actiepunten${tasks.length > 0 ? ` (${tasks.length})` : ''}` },
  ]

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${meeting.status === 'completed' ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-4">
          <div className={`text-center rounded-lg px-3 py-2 min-w-[56px] ${meeting.status === 'completed' ? 'bg-green-50' : 'bg-primary-50'}`}>
            <p className={`text-xs font-medium ${meeting.status === 'completed' ? 'text-green-600' : 'text-primary-600'}`}>
              {format(new Date(meeting.meeting_date), 'MMM', { locale: nl }).toUpperCase()}
            </p>
            <p className={`text-xl font-bold ${meeting.status === 'completed' ? 'text-green-700' : 'text-primary-700'}`}>
              {format(new Date(meeting.meeting_date), 'd')}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{meeting.title}</p>
              {statusBadge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {format(new Date(meeting.meeting_date), "EEEE d MMMM yyyy 'om' HH:mm", { locale: nl })}
              {meeting.location && ` · ${meeting.location}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isUpcoming && isBeheerder && pendingCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompileAgenda() }}
              className="flex items-center gap-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <ListChecks size={14} />
              Agenda samenstellen ({pendingCount})
            </button>
          )}
          {isUpcoming && isBeheerder && !meeting.teams_url && (
            <button
              onClick={(e) => { e.stopPropagation(); onCreateTeams() }}
              className="flex items-center gap-1.5 text-sm bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <Video size={14} />
              Teams uitnodiging
            </button>
          )}
          {meeting.teams_url && (
            <a href={meeting.teams_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">
              <Video size={14} />
              Deelnemen
            </a>
          )}
          {isBeheerder && meeting.status !== 'completed' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus.mutate('completed') }}
              className="flex items-center gap-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <CheckCircle2 size={14} />
              Afronden
            </button>
          )}
          {isBeheerder && meeting.status === 'completed' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus.mutate('planned') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5"
            >
              Heropen
            </button>
          )}
          {isBeheerder && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="text-gray-300 hover:text-primary-500 transition-colors p-1"
              title="Bewerken"
            >
              <Pencil size={15} />
            </button>
          )}
          {isBeheerder && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="text-gray-300 hover:text-red-500 transition-colors p-1"
              title="Verwijderen"
            >
              <Trash2 size={15} />
            </button>
          )}
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-6">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === key
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-6 py-5">
            {/* Agenda tab */}
            {activeTab === 'agenda' && (
              <div>
                {agenda.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">Geen agendapunten toegewezen.</p>
                    {isBeheerder && (
                      <button
                        onClick={addStandardAgenda}
                        disabled={addingStdAgenda}
                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                      >
                        <ListChecks size={15} />
                        {addingStdAgenda ? 'Toevoegen…' : 'Standaard VvE-agenda toevoegen'}
                      </button>
                    )}
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {[...agenda]
                      .sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999))
                      .map((item, i) => (
                        <li key={item.id} className="flex items-start gap-3 text-sm">
                          <span className="text-gray-400 w-5 shrink-0 pt-0.5">{i + 1}.</span>
                          <div>
                            <p className="text-gray-900 font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-gray-500 text-xs mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            )}

            {/* Notulen tab */}
            {activeTab === 'notulen' && (
              <div className="space-y-3">
                {minutes.length === 0 && (
                  <p className="text-sm text-gray-400">Nog geen notulen beschikbaar.</p>
                )}
                {minutes.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-4 text-sm ${
                      m.is_approved
                        ? 'border-green-200 bg-green-50'
                        : 'border-yellow-200 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.is_approved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {m.is_approved ? 'Goedgekeurd' : 'Ter goedkeuring'}
                      </span>
                      {isBeheerder && !m.is_approved && (
                        <button
                          onClick={() => approveMinutes.mutate(m.id)}
                          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-medium"
                        >
                          <Check size={12} /> Goedkeuren
                        </button>
                      )}
                    </div>
                    {m.content && (
                      <p className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed">
                        {m.content}
                      </p>
                    )}
                  </div>
                ))}
                {isBeheerder && <UploadMinutesForm vveId={vveId} meetingId={meeting.id} />}
              </div>
            )}

            {/* Actiepunten tab */}
            {activeTab === 'acties' && (
              <div className="space-y-3">
                {tasks.length === 0 && (
                  <p className="text-sm text-gray-400">Geen actiepunten voor deze vergadering.</p>
                )}
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() =>
                          updateTaskStatus.mutate({
                            taskId: task.id,
                            status: task.status === 'done' ? 'open' : 'done',
                          })
                        }
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          task.status === 'done'
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {task.status === 'done' && <Check size={11} className="text-white" />}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className="text-xs text-gray-400 mt-1">
                            Deadline: {format(new Date(task.due_date), 'd MMM yyyy', { locale: nl })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        task.status === 'done'
                          ? 'bg-green-100 text-green-700'
                          : task.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {task.status === 'done' ? 'Klaar' : task.status === 'in_progress' ? 'Bezig' : 'Open'}
                      </span>
                      {isBeheerder && (
                        <button
                          onClick={() => deleteTask.mutate(task.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Link
                  to="/taken"
                  className="mt-1 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <ArrowRight size={12} /> Beheren in Actiepunten
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function UploadMinutesForm({ vveId, meetingId }: { vveId: number; meetingId: number }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (text) fd.append('content', text)
      if (file) fd.append('file', file)
      return api.post(`/vves/${vveId}/meetings/${meetingId}/minutes`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['minutes', vveId, meetingId] })
      setText('')
      setFile(null)
      setOpen(false)
    },
  })

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
    >
      <Plus size={12} /> Notulen uploaden
    </button>
  )

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        placeholder="Plak of typ de notulen hier..."
      />
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600"
        >
          <Upload size={12} />
          {file ? file.name : 'PDF bijvoegen (optioneel)'}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setFile(null) }}
          className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"
        >
          Annuleren
        </button>
        <button
          onClick={() => (text || file) && upload.mutate()}
          disabled={(!text && !file) || upload.isPending}
          className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
        >
          Opslaan
        </button>
      </div>
    </div>
  )
}

function NewMeetingModal({ vveId, onClose, onSaved }: { vveId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', meeting_date: '', location: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post(`/vves/${vveId}/meetings`, {
        ...form,
        meeting_date: new Date(form.meeting_date).toISOString(),
      })
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Er is een fout opgetreden')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Vergadering aanmaken</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Algemene Ledenvergadering 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum en tijd *</label>
            <input
              type="datetime-local"
              required
              value={form.meeting_date}
              onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Online via Teams of adres"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
              Annuleren
            </button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">
              Aanmaken
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditMeetingModal({ vveId, meeting, onClose, onSaved }: {
  vveId: number; meeting: Meeting; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: meeting.title,
    meeting_date: meeting.meeting_date.slice(0, 16),
    location: meeting.location ?? '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.patch(`/vves/${vveId}/meetings/${meeting.id}`, {
        ...form,
        meeting_date: new Date(form.meeting_date).toISOString(),
        location: form.location || null,
      })
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Er is een fout opgetreden')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Vergadering bewerken</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum en tijd *</label>
            <input
              type="datetime-local"
              required
              value={form.meeting_date}
              onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
              Annuleren
            </button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">
              Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AgendaItemModal({ vveId, onClose, onSaved }: { vveId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', description: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post(`/vves/${vveId}/meetings/agenda`, form)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1">Agendapunt indienen</h2>
        <p className="text-sm text-gray-500 mb-4">Uw punt wordt door de beheerder toegevoegd aan de volgende vergadering.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp *</label>
            <input
              type="text"
              required
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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
              Annuleren
            </button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">
              Indienen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

