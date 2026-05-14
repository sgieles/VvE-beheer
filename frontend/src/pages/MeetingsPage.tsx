import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { Meeting, AgendaItem, MeetingMinutes } from '@/types'
import { Plus, CalendarPlus, ListChecks, FileText, Check, Video, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function MeetingsPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()

  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [showAgendaForm, setShowAgendaForm] = useState(false)
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null)

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
          <p className="text-gray-500 mt-1">Agenda, notulen en Teams uitnodigingen</p>
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

      {/* Ingediende agendapunten banner */}
      {isBeheerder && pendingItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <ListChecks size={18} />
            <span className="text-sm font-medium">{pendingItems.length} agendapunt(en) wachten op toewijzing aan een vergadering</span>
          </div>
        </div>
      )}

      {isLoading && <div className="text-gray-500">Laden...</div>}

      {/* Aankomende vergaderingen */}
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
              />
            ))}
          </div>
        </section>
      )}

      {/* Eerdere vergaderingen */}
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

      {showNewMeeting && <NewMeetingModal vveId={vveId!} onClose={() => setShowNewMeeting(false)} onSaved={() => { setShowNewMeeting(false); qc.invalidateQueries({ queryKey: ['meetings', vveId] }) }} />}
      {showAgendaForm && <AgendaItemModal vveId={vveId!} onClose={() => setShowAgendaForm(false)} onSaved={() => { setShowAgendaForm(false); qc.invalidateQueries({ queryKey: ['agenda-pending', vveId] }) }} />}
    </div>
  )
}

function MeetingCard({ meeting, vveId, isBeheerder, pendingCount, expanded, onToggle, onCreateTeams, onCompileAgenda }: {
  meeting: Meeting; vveId: number; isBeheerder: boolean; pendingCount: number
  expanded: boolean; onToggle: () => void; onCreateTeams: () => void; onCompileAgenda: () => void
}) {
  const qc = useQueryClient()
  const isUpcoming = meeting.status === 'planned' && new Date(meeting.meeting_date) > new Date()

  const { data: agenda = [] } = useQuery<AgendaItem[]>({
    queryKey: ['agenda', vveId, meeting.id],
    queryFn: () => api.get(`/vves/${vveId}/meetings/${meeting.id}/agenda`).then((r) => r.data),
    enabled: expanded,
  })

  const { data: minutes = [] } = useQuery<MeetingMinutes[]>({
    queryKey: ['minutes', vveId, meeting.id],
    queryFn: () => api.get(`/vves/${vveId}/meetings/${meeting.id}/minutes`).then((r) => r.data),
    enabled: expanded,
  })

  const approveMinutes = useMutation({
    mutationFn: (minutesId: number) =>
      api.post(`/vves/${vveId}/meetings/${meeting.id}/minutes/${minutesId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['minutes', vveId, meeting.id] }),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-4">
          <div className="text-center bg-primary-50 rounded-lg px-3 py-2 min-w-[56px]">
            <p className="text-xs text-primary-600 font-medium">{format(new Date(meeting.meeting_date), 'MMM', { locale: nl }).toUpperCase()}</p>
            <p className="text-xl font-bold text-primary-700">{format(new Date(meeting.meeting_date), 'd')}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{meeting.title}</p>
            <p className="text-sm text-gray-500">
              {format(new Date(meeting.meeting_date), "EEEE d MMMM yyyy 'om' HH:mm", { locale: nl })}
              {meeting.location && ` · ${meeting.location}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isUpcoming && isBeheerder && (
            <>
              {pendingCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCompileAgenda() }}
                  className="flex items-center gap-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  title="Koppel ingediende agendapunten aan deze vergadering"
                >
                  <ListChecks size={14} />
                  Agenda samenstellen ({pendingCount})
                </button>
              )}
              {!meeting.teams_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCreateTeams() }}
                  className="flex items-center gap-1.5 text-sm bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Video size={14} />
                  Teams uitnodiging versturen
                </button>
              )}
            </>
          )}
          {meeting.teams_url && (
            <a href={meeting.teams_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">
              <Video size={14} />
              Deelnemen
            </a>
          )}
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-6 py-5 grid grid-cols-2 gap-8">
          {/* Agenda */}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <ListChecks size={16} /> Agenda ({agenda.length} punten)
            </h3>
            {agenda.length === 0
              ? <p className="text-sm text-gray-400">Geen agendapunten toegewezen.</p>
              : <ol className="space-y-2">
                  {agenda.sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999)).map((item, i) => (
                    <li key={item.id} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-400 w-5 shrink-0">{i + 1}.</span>
                      <div>
                        <p className="text-gray-900">{item.title}</p>
                        {item.description && <p className="text-gray-500 text-xs">{item.description}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
            }
          </div>

          {/* Notulen */}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <FileText size={16} /> Notulen
            </h3>
            {minutes.length === 0
              ? <p className="text-sm text-gray-400">Nog geen notulen beschikbaar.</p>
              : minutes.map((m) => (
                  <div key={m.id} className={`rounded-lg border p-4 text-sm ${m.is_approved ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.is_approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {m.is_approved ? 'Goedgekeurd' : 'Ter goedkeuring'}
                      </span>
                      {isBeheerder && !m.is_approved && (
                        <button onClick={() => approveMinutes.mutate(m.id)}
                          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-medium">
                          <Check size={12} /> Goedkeuren
                        </button>
                      )}
                    </div>
                    {m.content && <p className="text-gray-700 whitespace-pre-wrap">{m.content.substring(0, 300)}{m.content.length > 300 ? '…' : ''}</p>}
                  </div>
                ))
            }

            {isBeheerder && (
              <UploadMinutesForm vveId={vveId} meetingId={meeting.id} />
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
  const [open, setOpen] = useState(false)

  const upload = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams()
      if (text) params.append('content', text)
      return api.post(`/vves/${vveId}/meetings/${meetingId}/minutes?${params.toString()}`)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['minutes', vveId, meetingId] }); setText(''); setOpen(false) },
  })

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
      <Plus size={12} /> Notulen uploaden
    </button>
  )

  return (
    <div className="mt-3 space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        placeholder="Plak of typ de notulen hier..." />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">Annuleren</button>
        <button onClick={() => upload.mutate()} className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 font-medium">Opslaan</button>
      </div>
    </div>
  )
}

function NewMeetingModal({ vveId, onClose, onSaved }: { vveId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', meeting_date: '', location: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post(`/vves/${vveId}/meetings`, {
      ...form,
      meeting_date: new Date(form.meeting_date).toISOString(),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Vergadering aanmaken</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input type="text" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Algemene Ledenvergadering 2025" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum en tijd *</label>
            <input type="datetime-local" required value={form.meeting_date} onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
            <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Online via Teams of adres" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">Aanmaken</button>
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
        <p className="text-sm text-gray-500 mb-4">Uw punt wordt toegevoegd aan de volgende vergadering door de beheerder.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp *</label>
            <input type="text" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Toelichting</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuleren</button>
            <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">Indienen</button>
          </div>
        </form>
      </div>
    </div>
  )
}
