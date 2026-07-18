import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import type { VvEDocument } from '@/types'
import { Upload, Download, Trash2, FileText, FolderOpen, Plus, Eye, X, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { toast } from '@/store/toastStore'
import { apiError } from '@/utils/apiError'
import ConfirmDialog from '@/components/ConfirmDialog'

const CATEGORIES = [
  { value: 'alle', label: 'Alle documenten' },
  { value: 'notulen', label: 'Notulen' },
  { value: 'contract', label: 'Contracten' },
  { value: 'offerte', label: 'Offertes' },
  { value: 'rapport', label: 'Rapporten' },
  { value: 'overig', label: 'Overig' },
]

const CATEGORY_COLORS: Record<string, string> = {
  notulen: 'bg-blue-100 text-blue-700',
  contract: 'bg-purple-100 text-purple-700',
  offerte: 'bg-amber-100 text-amber-700',
  rapport: 'bg-green-100 text-green-700',
  overig: 'bg-gray-100 text-gray-600',
}

function categoryLabel(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

export default function DocumentsPage() {
  const { user, activeVveId } = useAuthStore()
  const vveId = activeVveId
  const isBeheerder = user?.role === 'beheerder' || user?.role === 'platform_admin'
  const qc = useQueryClient()

  const [filterCat, setFilterCat] = useState('alle')
  const [showUpload, setShowUpload] = useState(false)
  const [confirmDel, setConfirmDel] = useState<VvEDocument | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ doc: VvEDocument; blobUrl: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<number | null>(null)

  const { data: documents = [], isLoading } = useQuery<VvEDocument[]>({
    queryKey: ['documents', vveId],
    queryFn: () => api.get(`/vves/${vveId}/documents`).then((r) => r.data),
    enabled: !!vveId,
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => api.delete(`/vves/${vveId}/documents/${docId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents', vveId] }); toast('Document verwijderd') },
    onError: (err) => toast(apiError(err, 'Verwijderen mislukt')),
  })

  async function handleDownload(doc: VvEDocument) {
    const response = await api.get(`/vves/${vveId}/documents/${doc.id}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.original_filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handlePreview(doc: VvEDocument) {
    setPreviewLoading(doc.id)
    try {
      const response = await api.get(`/vves/${vveId}/documents/${doc.id}/download`, { responseType: 'blob' })
      const mimeType = doc.original_filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (response.data as Blob).type
      const blob = new Blob([response.data as Blob], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
      setPreviewDoc({ doc, blobUrl })
    } catch {
      toast('Preview laden mislukt')
    } finally {
      setPreviewLoading(null)
    }
  }

  function closePreview() {
    if (previewDoc) URL.revokeObjectURL(previewDoc.blobUrl)
    setPreviewDoc(null)
  }

  function handleDelete(doc: VvEDocument) {
    setConfirmDel(doc)
  }

  const filtered = filterCat === 'alle'
    ? documents
    : documents.filter((d) => d.category === filterCat)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documenten</h1>
          <p className="text-gray-500 mt-1">
            Notulen, contracten, offertes en overige VvE-documenten
          </p>
        </div>
        {isBeheerder && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Upload size={16} />
            Document uploaden
          </button>
        )}
      </div>

      {/* Categorie filter */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCat(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterCat === cat.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat.label}
            {cat.value !== 'alle' && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({documents.filter((d) => d.category === cat.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-400 text-sm">Laden…</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <FolderOpen size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Geen documenten gevonden</p>
          {isBeheerder && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium mx-auto"
            >
              <Plus size={14} />
              Upload het eerste document
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Document</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Categorie</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Bestandsnaam</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Geüpload</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                        <FileText size={16} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_COLORS[doc.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {categoryLabel(doc.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={doc.original_filename}>
                    {doc.original_filename}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {format(new Date(doc.uploaded_at), 'd MMM yyyy', { locale: nl })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handlePreview(doc)}
                        disabled={previewLoading === doc.id}
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium border border-gray-200 hover:border-gray-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        title="Bekijken"
                      >
                        {previewLoading === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                        Bekijken
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium border border-primary-200 hover:border-primary-300 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Download size={13} />
                        Download
                      </button>
                      {isBeheerder && (
                        <button
                          onClick={() => handleDelete(doc)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1.5"
                          title="Verwijderen"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 flex flex-col z-50">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={16} className="text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">{previewDoc.doc.title}</span>
              <span className="text-xs text-gray-400 truncate hidden sm:block">{previewDoc.doc.original_filename}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleDownload(previewDoc.doc)}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium border border-primary-200 px-2.5 py-1.5 rounded-lg"
              >
                <Download size={13} />
                Download
              </button>
              <button onClick={closePreview} className="p-1.5 text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-gray-800">
            {previewDoc.doc.original_filename.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={previewDoc.blobUrl}
                className="w-full h-full border-0"
                title={previewDoc.doc.title}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-4">
                <FileText size={48} />
                <p className="text-sm">Preview niet beschikbaar voor dit bestandstype.</p>
                <button
                  onClick={() => handleDownload(previewDoc.doc)}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  <Download size={15} />
                  Downloaden
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          vveId={vveId!}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false)
            qc.invalidateQueries({ queryKey: ['documents', vveId] })
          }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Verwijder "${confirmDel.title}"? Dit kan niet ongedaan worden gemaakt.`}
          onConfirm={() => { deleteMutation.mutate(confirmDel.id); setConfirmDel(null) }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

function UploadModal({ vveId, onClose, onSaved }: {
  vveId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ title: '', category: 'overig', description: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !form.title) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const params = new URLSearchParams({ title: form.title, category: form.category })
      if (form.description) params.append('description', form.description)
      await api.post(`/vves/${vveId}/documents?${params.toString()}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onSaved()
    } catch (err: unknown) {
      setError(apiError(err, 'Upload mislukt'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Document uploaden</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="bijv. Notulen ALV juni 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
            >
              {CATEGORIES.filter((c) => c.value !== 'alle').map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving (optioneel)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="Korte omschrijving"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bestand *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                file ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
              }`}
            >
              {file ? (
                <p className="text-sm text-primary-700 font-medium">{file.name}</p>
              ) : (
                <div>
                  <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-sm text-gray-500">Klik om een bestand te kiezen</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, Word, Excel of afbeelding</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!file || !form.title || uploading}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {uploading ? 'Uploaden…' : 'Uploaden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
